"""Read-only query helpers for the CRM screen.

Selectors encapsulate filtering, related-object prefetching, and aggregates so
that views only deal with HTTP concerns.
"""

from django.db.models import Count, Q, Sum

from .models import Contact


def get_contacts(query="", status=""):
    """Return the dashboard contact list ordered by most recently updated."""
    contacts = Contact.objects.all().order_by("-updated_at")
    if query:
        contacts = contacts.filter(
            Q(name__icontains=query)
            | Q(email__icontains=query)
            | Q(company__icontains=query)
            | Q(owner__icontains=query)
        )
    if status:
        contacts = contacts.filter(status=status)
    return contacts


def get_selected_contact(selected_id, contacts):
    """Return the requested contact, falling back to the first listed contact."""
    selected = None
    if selected_id:
        try:
            selected = Contact.objects.prefetch_related("activities").get(
                pk=selected_id
            )
        except Contact.DoesNotExist, ValueError:
            selected = None
    if selected is None:
        selected = contacts.first()
    return selected


def get_dashboard_summary():
    """Return contact totals, pipeline value, and per-status counts."""
    totals = Contact.objects.aggregate(total=Count("id"), pipeline=Sum("value"))
    counts_by_status = {
        row["status"]: row["count"]
        for row in Contact.objects.values("status").annotate(count=Count("id"))
    }
    status_counts = {
        key: counts_by_status.get(key, 0) for key, label in Contact.STATUS_CHOICES
    }
    return {
        "total": totals["total"] or 0,
        "pipeline": totals["pipeline"] or 0,
        "status_counts": status_counts,
    }
