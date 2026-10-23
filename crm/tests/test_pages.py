"""Page-prop contract of the dashboard read model."""

import re
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from django.test import RequestFactory, TestCase
from django.utils import timezone

from crm.models import Activity, Contact
from crm.pages import dashboard_props

TIMESTAMP_RE = re.compile(r"^\d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}$")


class DashboardPropsTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def props(self, **params):
        return dashboard_props(self.factory.get("/", params))

    def make_contact(self, **overrides):
        defaults = {"name": "Contact", "status": "lead", "value": 0}
        return Contact.objects.create(**{**defaults, **overrides})

    def test_empty_state(self):
        props = self.props()
        self.assertEqual(props["contacts"], [])
        self.assertIsNone(props["selected"])
        self.assertEqual(props["summary"]["total"], 0)
        self.assertEqual(props["summary"]["pipeline"], 0.0)
        self.assertEqual(
            props["summary"]["statusCounts"],
            {"lead": 0, "qualified": 0, "customer": 0, "inactive": 0},
        )

    def test_contact_rows_expose_client_fields(self):
        contact = self.make_contact(
            name="Ekky Example",
            email="ekky@example.com",
            company="Altogether",
            value=1000,
        )
        props = self.props()

        self.assertEqual(
            props["contacts"],
            [
                {
                    "id": contact.id,
                    "name": "Ekky Example",
                    "email": "ekky@example.com",
                    "company": "Altogether",
                    "phone": "",
                    "status": "lead",
                    "statusLabel": "Lead",
                    "owner": "",
                    "value": 1000.0,
                    "selected": True,
                    "url": f"/?contact={contact.id}",
                }
            ],
        )

    def test_search_filters_rows(self):
        self.make_contact(name="Ekky", company="Altogether")
        self.make_contact(name="Someone Else", company="Other")

        names = [row["name"] for row in self.props(q="Altogether")["contacts"]]

        self.assertEqual(names, ["Ekky"])

    def test_status_filter_narrows_rows_and_summary_stays_global(self):
        self.make_contact(name="Lead One", status="lead")
        self.make_contact(name="Customer One", status="customer", value=500)

        props = self.props(status="lead")

        self.assertEqual([row["name"] for row in props["contacts"]], ["Lead One"])
        self.assertEqual(props["summary"]["total"], 2)
        self.assertEqual(props["summary"]["pipeline"], 500.0)

    def test_query_is_stripped(self):
        self.assertEqual(self.props(q="  padded  ")["filters"]["q"], "padded")

    def test_explicit_selection(self):
        first = self.make_contact(name="First")
        second = self.make_contact(name="Second")

        props = self.props(contact=str(second.id))

        self.assertEqual(props["selected"]["id"], second.id)
        self.assertTrue(
            next(row for row in props["contacts"] if row["id"] == second.id)["selected"]
        )
        self.assertFalse(
            next(row for row in props["contacts"] if row["id"] == first.id)["selected"]
        )

    def test_selection_falls_back_to_first_listed_contact(self):
        self.make_contact(name="First")
        props = self.props()
        self.assertEqual(props["selected"]["name"], "First")

    def test_unknown_selection_falls_back_to_first_listed_contact(self):
        self.make_contact(name="First")
        props = self.props(contact="999999")
        self.assertEqual(props["selected"]["name"], "First")

    def test_selection_missing_from_filtered_list_still_resolves(self):
        selected = self.make_contact(name="Customer", status="customer")
        self.make_contact(name="Lead", status="lead")

        props = self.props(status="lead", contact=str(selected.id))

        self.assertEqual(props["selected"]["id"], selected.id)
        self.assertFalse(any(row["selected"] for row in props["contacts"]))

    def test_activities_are_limited_to_twenty_most_recent(self):
        contact = self.make_contact()
        now = timezone.now()
        for index in range(25):
            activity = Activity.objects.create(contact=contact, body=f"note {index}")
            Activity.objects.filter(pk=activity.pk).update(
                created_at=now - timedelta(minutes=index)
            )

        activities = self.props(contact=str(contact.id))["selected"]["activities"]

        self.assertEqual(len(activities), 20)
        self.assertEqual(
            [a["body"] for a in activities], [f"note {i}" for i in range(20)]
        )
        self.assertTrue(all(TIMESTAMP_RE.match(a["createdAt"]) for a in activities))
        self.assertTrue(all(a["createdBy"] == "Interview User" for a in activities))

    def test_status_choices_follow_model_order(self):
        props = self.props()
        self.assertEqual(
            [choice["value"] for choice in props["statusChoices"]],
            ["lead", "qualified", "customer", "inactive"],
        )
        self.assertEqual(props["statusChoices"][0]["label"], "Lead")

    def test_row_url_encodes_special_characters(self):
        query = "a b&c#d é"
        contact = self.make_contact(company=query)

        props = self.props(q=query, status="lead")
        parsed = urlparse(props["contacts"][0]["url"])

        self.assertEqual(parse_qs(parsed.query)["q"], [query])
        self.assertEqual(parse_qs(parsed.query)["status"], ["lead"])
        self.assertEqual(parse_qs(parsed.query)["contact"], [str(contact.id)])

    def test_page_props_do_not_carry_errors(self):
        """Errors are a shared prop from the middleware, never a page prop."""
        self.assertNotIn("errors", self.props())
