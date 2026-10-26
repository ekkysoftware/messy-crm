"""Write-side services for the CRM screen.

Each service owns the transaction boundary for its business action so that
related writes (for example creating a contact and its first activity) either
both succeed or both roll back.
"""

from django.db import transaction

from .models import Activity, Contact


@transaction.atomic
def create_contact(*, name, email, company, owner, phone, value, status):
    contact = Contact.objects.create(
        name=name,
        email=email,
        company=company,
        owner=owner,
        phone=phone,
        value=value,
        status=status,
    )
    Activity.objects.create(contact=contact, kind="system", body="Contact created")
    return contact


@transaction.atomic
def update_contact(*, contact, name, email, company, owner, phone, value, status):
    """Update a contact and record only the changes worth showing in history."""
    updates = {
        "name": name,
        "email": email,
        "company": company,
        "owner": owner,
        "phone": phone,
        "value": value,
        "status": status,
    }
    changed = [
        field
        for field, new_value in updates.items()
        if getattr(contact, field) != new_value
    ]
    if not changed:
        return contact

    previous_status = contact.status
    for field in changed:
        setattr(contact, field, updates[field])
    contact.save(update_fields=[*changed, "updated_at"])

    if "status" in changed:
        Activity.objects.create(
            contact=contact,
            kind="status",
            body=f"Status changed from {previous_status} to {status}",
        )
    if any(field != "status" for field in changed):
        Activity.objects.create(contact=contact, kind="system", body="Contact updated")
    return contact


@transaction.atomic
def change_status(*, contact, new_status):
    old = contact.status
    contact.status = new_status
    contact.save()
    Activity.objects.create(
        contact=contact,
        kind="status",
        body=f"Status changed from {old} to {new_status}",
    )
    return contact


@transaction.atomic
def add_note(*, contact, body):
    if body:
        Activity.objects.create(contact=contact, body=body, kind="note")
    return contact


@transaction.atomic
def delete_contact(*, contact):
    contact.delete()
