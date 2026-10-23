"""Builds the Inertia page props for the CRM dashboard.

Validation errors are not page props here: they arrive through the one-shot
shared prop added by ``crm.middleware.ShareInertiaErrorsMiddleware``.

This is the only place that translates the read model into the JSON contract
the React client consumes, so the page looks identical whether it was produced
by a first load or by an Inertia visit.
"""

from urllib.parse import urlencode

from django.urls import reverse

from .models import Contact
from .selectors import get_contacts, get_dashboard_summary, get_selected_contact

DASHBOARD_COMPONENT = "crm/Dashboard"
ACTIVITY_LIMIT = 20


def return_url(q="", status="", contact_id=None):
    """Dashboard URL that restores the active filters and selection."""
    params = {}
    if q:
        params["q"] = q
    if status:
        params["status"] = status
    if contact_id:
        params["contact"] = str(contact_id)
    query = urlencode(params)
    return reverse("crm") + (("?" + query) if query else "")


def dashboard_props(request):
    q = request.GET.get("q", "").strip()
    status = request.GET.get("status", "").strip()
    selected_id = request.GET.get("contact", "").strip()

    contacts = get_contacts(q, status)
    selected = get_selected_contact(selected_id, contacts)
    summary = get_dashboard_summary()

    return {
        "contacts": [_contact_row(c, q, status, selected) for c in contacts],
        "selected": _contact_detail(selected),
        "filters": {"q": q, "status": status},
        "summary": {
            "total": summary["total"],
            "pipeline": float(summary["pipeline"] or 0),
            "statusCounts": summary["status_counts"],
        },
        "statusChoices": [
            {"value": value, "label": label} for value, label in Contact.STATUS_CHOICES
        ],
    }


def _contact_row(contact, q, status, selected):
    return {
        "id": contact.id,
        "name": contact.name,
        "email": contact.email,
        "company": contact.company,
        "phone": contact.phone,
        "status": contact.status,
        "statusLabel": contact.get_status_display(),
        "owner": contact.owner,
        "value": float(contact.value),
        "selected": bool(selected and selected.id == contact.id),
        "url": return_url(q, status, contact.id),
    }


def _contact_detail(contact):
    if contact is None:
        return None

    return {
        "id": contact.id,
        "name": contact.name,
        "email": contact.email,
        "company": contact.company,
        "phone": contact.phone,
        "status": contact.status,
        "owner": contact.owner,
        "value": float(contact.value),
        "activities": [
            {
                "kind": activity.kind,
                "body": activity.body,
                "createdBy": activity.created_by,
                "createdAt": activity.created_at.strftime("%d %b %Y %H:%M"),
            }
            for activity in contact.activities.all()[:ACTIVITY_LIMIT]
        ],
    }
