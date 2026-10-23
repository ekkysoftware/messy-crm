"""URL contract of the dashboard screen."""

from urllib.parse import parse_qs, urlparse

from django.urls import reverse
from inertia.test import InertiaTestCase

from crm.models import Contact


class ReturnUrlEncodingTests(InertiaTestCase):
    def test_special_characters_round_trip(self):
        query = "a b&c#d é"
        Contact.objects.create(name="Encoded", company=query)

        self.inertia.get(reverse("crm"), {"q": query})
        props = self.props()
        parsed = urlparse(props["contacts"][0]["url"])

        self.assertEqual(props["filters"]["q"], query)
        self.assertEqual(parse_qs(parsed.query)["q"], [query])

    def test_row_url_preserves_active_status_filter(self):
        contact = Contact.objects.create(name="Lead", status="lead")

        self.inertia.get(reverse("crm"), {"status": "lead"})
        parsed = urlparse(self.props()["contacts"][0]["url"])

        self.assertEqual(parse_qs(parsed.query)["status"], ["lead"])
        self.assertEqual(parse_qs(parsed.query)["contact"], [str(contact.id)])
