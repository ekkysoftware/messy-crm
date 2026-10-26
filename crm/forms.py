"""Forms that own validation for the CRM screen's write commands.

Creating preserves the original coercion rules: a blank name is rejected,
an unparsable value becomes ``Decimal("0")``, and an unknown status becomes
``lead``. Editing rejects invalid values and statuses instead.
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
    """Editing requires a valid value and status before saving any changes."""

    def clean_value(self):
        return (
            Contact._meta.get_field("value")
            .formfield()
            .clean(self.cleaned_data["value"])
        )

    def clean_new_status(self):
        return forms.ChoiceField(choices=Contact.STATUS_CHOICES).clean(
            self.cleaned_data["new_status"]
        )


class StatusChangeForm(forms.Form):
    new_status = forms.ChoiceField(choices=Contact.STATUS_CHOICES)


class BulkStatusForm(forms.Form):
    """Validate a bulk status change: one valid status and integer ids."""

    new_status = forms.ChoiceField(choices=Contact.STATUS_CHOICES)
    ids = forms.CharField()

    def clean_ids(self):
        raw = (self.cleaned_data.get("ids") or "").strip()
        ids = []
        for part in raw.split(","):
            part = part.strip()
            if not part:
                continue
            try:
                ids.append(int(part))
            except ValueError:
                raise forms.ValidationError("Select valid contacts.")
        if not ids:
            raise forms.ValidationError("Select at least one contact.")
        return ids


class NoteForm(forms.Form):
    note = forms.CharField(required=False)
