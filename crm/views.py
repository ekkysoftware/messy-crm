import csv
import json

from django.contrib import messages
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect
from django.views import View
from inertia import render as inertia_render

from .forms import ContactCreateForm, NoteForm, StatusChangeForm
from .middleware import _first_errors, flash_errors
from .models import Contact
from .pages import DASHBOARD_COMPONENT, dashboard_props, return_url
from .services import add_note, change_status, create_contact, delete_contact


class CommandView(View):
    """Shared plumbing for the dashboard's write commands.

    Every command reads the same payload, carries the same filters into its
    redirect and reports validation failures the same way, so that plumbing
    lives here. Subclasses only describe their effect.
    """

    def payload(self, request: HttpRequest) -> dict:
        """Return the request body as a mapping for JSON (Inertia) or form posts."""
        if request.content_type == "application/json":
            try:
                payload = json.loads(request.body or b"{}")
            except ValueError:
                return {}
            return payload if isinstance(payload, dict) else {}
        return request.POST

    def filters(self, request: HttpRequest, data) -> tuple[str, str]:
        """Filters travel in the payload or the query string, whichever is present."""
        q = (data.get("q") or request.GET.get("q") or "").strip()
        status = (data.get("status") or request.GET.get("status") or "").strip()
        return q, status

    def reject(self, request, form, q, status, contact_id=None) -> HttpResponse:
        """Flash the first error per field and send the client back to the screen."""
        flash_errors(request, _first_errors(form))
        return redirect(return_url(q, status, contact_id))


class ContactView(CommandView):
    """The dashboard screen and its contact commands.

    One class covers the contact surface: a route renders the screen, and one
    route per command serves create, re-status and delete. Each route pins the
    single verb it answers in `urls.py`, so adding a handler here cannot quietly
    widen another route.
    """

    def get(self, request: HttpRequest) -> HttpResponse:
        """Render the dashboard as an Inertia page."""
        return inertia_render(request, DASHBOARD_COMPONENT, dashboard_props(request))

    def post(self, request: HttpRequest) -> HttpResponse:
        """Create a contact from the dashboard's create form."""
        data = self.payload(request)
        q, status = self.filters(request, data)

        form = ContactCreateForm(data)
        if not form.is_valid():
            return self.reject(request, form, q, status)

        contact = create_contact(
            name=form.cleaned_data["name"],
            email=form.cleaned_data["email"],
            company=form.cleaned_data["company"],
            owner=form.cleaned_data["owner"],
            phone=form.cleaned_data["phone"],
            value=form.cleaned_data["value"],
            status=form.cleaned_data["new_status"],
        )
        messages.success(request, f"Created {contact.name}")
        return redirect(return_url(q, status, contact.id))

    def patch(self, request: HttpRequest, pk: int) -> HttpResponse:
        """Move a contact to a new status."""
        contact = get_object_or_404(Contact, pk=pk)
        data = self.payload(request)
        q, status = self.filters(request, data)

        form = StatusChangeForm(data)
        if not form.is_valid():
            return self.reject(request, form, q, status, contact.id)

        change_status(contact=contact, new_status=form.cleaned_data["new_status"])
        messages.success(request, f"Status changed to {contact.status}")
        return redirect(return_url(q, status, contact.id))

    def delete(self, request: HttpRequest, pk: int) -> HttpResponse:
        """Delete a contact and its activity history."""
        contact = get_object_or_404(Contact, pk=pk)
        q, status = self.filters(request, self.payload(request))

        delete_contact(contact=contact)
        messages.success(request, "Contact deleted")
        return redirect(return_url(q, status))


class AddContactNoteView(CommandView):
    def post(self, request: HttpRequest, pk: int) -> HttpResponse:
        contact = get_object_or_404(Contact, pk=pk)
        data = self.payload(request)
        q, status = self.filters(request, data)

        form = NoteForm(data)
        if form.is_valid() and form.cleaned_data["note"]:
            add_note(contact=contact, body=form.cleaned_data["note"])
            messages.success(request, "Note added")
        return redirect(return_url(q, status, contact.id))


class ExportContactsView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="contacts.csv"'
        writer = csv.writer(response)
        writer.writerow(
            ["Name", "Email", "Company", "Phone", "Status", "Owner", "Value"]
        )
        for c in Contact.objects.all().order_by("name"):
            writer.writerow(
                [c.name, c.email, c.company, c.phone, c.status, c.owner, c.value]
            )
        return response
