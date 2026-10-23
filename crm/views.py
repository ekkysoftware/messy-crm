import csv
import json

from django.contrib import messages
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_http_methods, require_POST
from inertia import render as inertia_render

from .forms import ContactCreateForm, NoteForm, StatusChangeForm
from .middleware import flash_errors
from .models import Contact
from .pages import dashboard_props, return_url
from .services import add_note, change_status, create_contact, delete_contact


def crm_screen(request):
    """Render the CRM dashboard as an Inertia page."""
    return inertia_render(request, "crm/Dashboard", dashboard_props(request))


@require_POST
def create_contact_view(request):
    data = _payload(request)
    q, status = _filters(request, data)

    form = ContactCreateForm(data)
    if not form.is_valid():
        flash_errors(request, _first_errors(form))
        return redirect(return_url(q, status))

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


@require_http_methods(["PATCH"])
def update_contact_status(request, pk):
    contact = get_object_or_404(Contact, pk=pk)
    data = _payload(request)
    q, status = _filters(request, data)

    form = StatusChangeForm(data)
    if not form.is_valid():
        flash_errors(request, _first_errors(form))
        return redirect(return_url(q, status, contact.id))

    change_status(contact=contact, new_status=form.cleaned_data["new_status"])
    messages.success(request, f"Status changed to {contact.status}")
    return redirect(return_url(q, status, contact.id))


@require_POST
def add_contact_note(request, pk):
    contact = get_object_or_404(Contact, pk=pk)
    data = _payload(request)
    q, status = _filters(request, data)

    form = NoteForm(data)
    if form.is_valid() and form.cleaned_data["note"]:
        add_note(contact=contact, body=form.cleaned_data["note"])
        messages.success(request, "Note added")
    return redirect(return_url(q, status, contact.id))


@require_http_methods(["DELETE"])
def delete_contact_view(request, pk):
    contact = get_object_or_404(Contact, pk=pk)
    q, status = _filters(request, _payload(request))

    delete_contact(contact=contact)
    messages.success(request, "Contact deleted")
    return redirect(return_url(q, status))


def export_contacts(request):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="contacts.csv"'
    writer = csv.writer(response)
    writer.writerow(["Name", "Email", "Company", "Phone", "Status", "Owner", "Value"])
    for c in Contact.objects.all().order_by("name"):
        writer.writerow([c.name, c.email, c.company, c.phone, c.status, c.owner, c.value])
    return response


def _payload(request: HttpRequest) -> dict:
    """Return the request body as a mapping for JSON (Inertia) or form posts."""
    if request.content_type == "application/json":
        try:
            payload = json.loads(request.body or b"{}")
        except ValueError:
            return {}
        return payload if isinstance(payload, dict) else {}
    return request.POST


def _filters(request: HttpRequest, data) -> tuple[str, str]:
    """Filters travel in the payload or the query string, whichever is present."""
    q = (data.get("q") or request.GET.get("q") or "").strip()
    status = (data.get("status") or request.GET.get("status") or "").strip()
    return q, status


def _first_errors(form) -> dict[str, str]:
    """Flatten a Django form's errors to one message per field."""
    return {
        field: entries[0]["message"]
        for field, entries in form.errors.get_json_data().items()
    }
