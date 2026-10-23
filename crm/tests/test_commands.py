"""Write-side behaviour of the CRM dashboard screen."""

from decimal import Decimal
from urllib.parse import parse_qs, urlparse

from django.urls import reverse
from inertia.test import InertiaTestCase

from crm.models import Activity, Contact

JSON = "application/json"


class CommandTestCase(InertiaTestCase):
    def setUp(self):
        super().setUp()
        self.contact = Contact.objects.create(
            name="Ekky Example",
            email="ekky@example.com",
            company="Altogether",
            status="lead",
            value=1000,
        )

    def create_contact(self, follow=False, **payload):
        return self.inertia.post(
            reverse("create_contact"), payload, content_type=JSON, follow=follow
        )

    def patch_status(self, pk, follow=False, **payload):
        return self.inertia.patch(
            reverse("update_contact_status", args=[pk]),
            payload,
            content_type=JSON,
            follow=follow,
        )

    def add_note(self, pk, follow=False, **payload):
        return self.inertia.post(
            reverse("add_contact_note", args=[pk]), payload, content_type=JSON, follow=follow
        )

    def delete_contact(self, pk, follow=False, **payload):
        return self.inertia.delete(
            reverse("delete_contact", args=[pk]),
            payload,
            content_type=JSON,
            follow=follow,
        )

    def flash_messages(self):
        return self.page().get("flash", {}).get("messages", [])


class CreateContactTests(CommandTestCase):
    def test_valid_creation_stores_contact_and_system_activity(self):
        response = self.create_contact(name="New Person", value="2500", new_status="qualified")

        contact = Contact.objects.get(name="New Person")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(contact.status, "qualified")
        self.assertEqual(contact.value, Decimal("2500"))
        self.assertTrue(
            Activity.objects.filter(contact=contact, kind="system", body="Contact created").exists()
        )

    def test_blank_name_reports_error_and_stores_nothing(self):
        self.create_contact(name="", follow=True)

        self.assertEqual(self.props()["errors"]["name"], "Name is required")
        self.assertFalse(Contact.objects.filter(name="").exists())
        self.assertNotIn("flash", self.page())

    def test_errors_are_consumed_after_one_response(self):
        self.create_contact(name="", follow=True)
        self.assertIn("errors", self.props())

        self.inertia.get(reverse("crm"))
        self.assertNotIn("errors", self.props())

    def test_unparsable_value_becomes_zero(self):
        self.create_contact(name="Bad Value", value="not-a-number")
        self.assertEqual(Contact.objects.get(name="Bad Value").value, Decimal("0"))

    def test_unknown_status_is_coerced_to_lead(self):
        self.create_contact(name="Unknown Status", new_status="bogus")
        self.assertEqual(Contact.objects.get(name="Unknown Status").status, "lead")

    def test_new_contact_is_selected_in_the_redirect(self):
        response = self.create_contact(name="Fresh")

        contact = Contact.objects.get(name="Fresh")
        self.assertEqual(response["Location"], f"/?contact={contact.id}")

    def test_success_flash_names_the_contact(self):
        self.create_contact(name="New Person", follow=True)

        self.assertEqual(
            self.flash_messages(),
            [{"level": "success", "message": "Created New Person"}],
        )
        self.assertNotIn("flash", self.props())


class StatusChangeTests(CommandTestCase):
    def test_change_status(self):
        response = self.patch_status(self.contact.id, new_status="qualified")

        self.contact.refresh_from_db()
        # InertiaMiddleware upgrades PATCH/DELETE redirects to 303.
        self.assertEqual(response.status_code, 303)
        self.assertEqual(self.contact.status, "qualified")
        self.assertEqual(
            Activity.objects.get(contact=self.contact, kind="status").body,
            "Status changed from lead to qualified",
        )

    def test_unknown_status_is_rejected_with_an_error(self):
        self.patch_status(self.contact.id, new_status="bogus", follow=True)

        self.contact.refresh_from_db()
        self.assertEqual(self.contact.status, "lead")
        self.assertIn("new_status", self.props()["errors"])
        self.assertNotIn("flash", self.page())

    def test_unknown_contact_is_not_found(self):
        response = self.patch_status(999999, new_status="qualified")
        self.assertEqual(response.status_code, 404)

    def test_success_flash_reports_the_new_status(self):
        self.patch_status(self.contact.id, new_status="qualified", follow=True)

        self.assertEqual(
            self.flash_messages(),
            [{"level": "success", "message": "Status changed to qualified"}],
        )


class AddNoteTests(CommandTestCase):
    def test_add_note(self):
        self.add_note(self.contact.id, note="Called customer")

        activity = Activity.objects.get(contact=self.contact, body="Called customer")
        self.assertEqual(activity.kind, "note")

    def test_blank_note_creates_no_activity(self):
        self.add_note(self.contact.id, note="   ")
        self.assertFalse(Activity.objects.filter(contact=self.contact).exists())

    def test_success_flash_confirms_the_note(self):
        self.add_note(self.contact.id, note="Called customer", follow=True)

        self.assertEqual(
            self.flash_messages(),
            [{"level": "success", "message": "Note added"}],
        )

    def test_unknown_contact_is_not_found(self):
        response = self.add_note(999999, note="Nope")
        self.assertEqual(response.status_code, 404)


class DeleteContactTests(CommandTestCase):
    def test_delete_removes_contact_and_activities(self):
        Activity.objects.create(contact=self.contact, body="history")
        response = self.delete_contact(self.contact.id)

        self.assertEqual(response.status_code, 303)
        self.assertFalse(Contact.objects.filter(pk=self.contact.id).exists())
        self.assertFalse(Activity.objects.filter(contact_id=self.contact.id).exists())

    def test_delete_returns_dashboard_without_selection(self):
        response = self.delete_contact(self.contact.id)
        self.assertEqual(response["Location"], "/")

    def test_delete_keeps_active_filters(self):
        response = self.delete_contact(self.contact.id, q="Ekky", status="lead")
        parsed = urlparse(response["Location"])
        self.assertEqual(parse_qs(parsed.query), {"q": ["Ekky"], "status": ["lead"]})

    def test_unknown_contact_is_not_found(self):
        response = self.delete_contact(999999)

        self.assertEqual(response.status_code, 404)
        self.inertia.get(reverse("crm"))
        self.assertNotIn("flash", self.page())

    def test_success_flash_confirms_the_delete(self):
        self.delete_contact(self.contact.id, follow=True)

        self.assertEqual(
            self.flash_messages(),
            [{"level": "success", "message": "Contact deleted"}],
        )


class FilterRestorationTests(CommandTestCase):
    def test_create_keeps_filters_in_the_redirect(self):
        response = self.create_contact(name="Filtered", q="Alt", status="lead")
        parsed = urlparse(response["Location"])
        query = parse_qs(parsed.query)

        self.assertEqual(query["q"], ["Alt"])
        self.assertEqual(query["status"], ["lead"])
        self.assertEqual(query["contact"], [str(Contact.objects.get(name="Filtered").id)])

    def test_status_change_keeps_filters_in_the_redirect(self):
        response = self.patch_status(self.contact.id, new_status="qualified", q="Ekky", status="lead")
        query = parse_qs(urlparse(response["Location"]).query)

        self.assertEqual(query["q"], ["Ekky"])
        self.assertEqual(query["status"], ["lead"])
        self.assertEqual(query["contact"], [str(self.contact.id)])

    def test_filters_survive_the_redirect_into_page_props(self):
        self.patch_status(self.contact.id, new_status="qualified", q="Ekky", status="lead", follow=True)

        props = self.props()
        self.assertEqual(props["filters"], {"q": "Ekky", "status": "lead"})
        self.assertEqual(props["selected"]["id"], self.contact.id)


class FlashDeliveryTests(CommandTestCase):
    def test_confirmation_is_consumed_after_one_response(self):
        self.create_contact(name="Once", follow=True)
        self.assertEqual(
            self.flash_messages(),
            [{"level": "success", "message": "Created Once"}],
        )

        self.inertia.get(reverse("crm"))
        self.assertNotIn("flash", self.page())

    def test_confirmation_is_delivered_on_a_partial_reload(self):
        self.create_contact(name="Partial Person")

        self.inertia.get(
            reverse("crm"),
            HTTP_X_INERTIA_PARTIAL_DATA="contacts",
            HTTP_X_INERTIA_PARTIAL_COMPONENT="crm/Dashboard",
        )

        self.assertEqual(
            self.flash_messages(),
            [{"level": "success", "message": "Created Partial Person"}],
        )
        self.assertNotIn("flash", self.props())


class LegacyDispatchRemovedTests(CommandTestCase):
    def test_posting_the_legacy_action_field_writes_nothing(self):
        before = Contact.objects.count()

        response = self.client.post(
            reverse("crm"), {"action": "add_contact", "name": "Should Not Exist"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Contact.objects.count(), before)
        self.assertFalse(Contact.objects.filter(name="Should Not Exist").exists())
