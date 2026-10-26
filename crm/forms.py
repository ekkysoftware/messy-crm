"""Forms that own validation for the CRM screen's write commands.

These reproduce the original inline rules exactly: a blank name is rejected,
an unparsable value becomes ``Decimal("0")``, and an unknown status is coerced
to ``lead`` rather than rejected.
"""

from decimal import Decimal, InvalidOperation

from django import forms

from .models import Contact


class ContactCreateForm(forms.Form):
    name = forms.CharField(error_messages={"required": "Name is required"})
    email = forms.CharField(required=False)
    company = forms.CharField(required=False)
    owner = forms.CharField(required=False)
    phone = forms.CharField(required=False)
    value = forms.CharField(required=False)
    new_status = forms.CharField(required=False)

    def clean_value(self):
        raw = (self.cleaned_data.get("value") or "").strip()
        try:
            return Decimal(raw or "0")
        except InvalidOperation:
            return Decimal(0)

    def clean_new_status(self):
        new_status = (self.cleaned_data.get("new_status") or "").strip()
        if new_status not in dict(Contact.STATUS_CHOICES):
            return "lead"
        return new_status


class ContactUpdateForm(ContactCreateForm):
    """Editing accepts the same fields and coercion rules as creating."""


class StatusChangeForm(forms.Form):
    new_status = forms.ChoiceField(choices=Contact.STATUS_CHOICES)


class NoteForm(forms.Form):
    note = forms.CharField(required=False)
