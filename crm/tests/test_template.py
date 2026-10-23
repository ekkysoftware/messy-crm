"""First-load document contract of the dashboard screen."""

import json
import re

from django.urls import reverse
from inertia.test import InertiaTestCase

from crm.models import Contact

PAGE_PAYLOAD_RE = re.compile(
    r'<script data-page="app" type="application/json">(.*?)</script>', re.DOTALL
)


class DashboardFirstLoadTests(InertiaTestCase):
    def setUp(self):
        super().setUp()
        Contact.objects.create(name="One")

    def page_payload(self, response):
        match = PAGE_PAYLOAD_RE.search(response.content.decode())
        self.assertIsNotNone(match, "first load must embed the Inertia page payload")
        return json.loads(match.group(1))

    def test_first_load_renders_shell_and_vite_entry(self):
        response = self.client.get(reverse("crm"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "<title>Jellybean CRM</title>")
        self.assertContains(response, "src/app.tsx")

    def test_first_load_embeds_page_payload(self):
        payload = self.page_payload(self.client.get(reverse("crm")))

        self.assertEqual(payload["component"], "crm/Dashboard")
        self.assertEqual(payload["props"]["contacts"][0]["name"], "One")
        self.assertEqual(payload["url"], "/")

    def test_first_load_no_longer_embeds_legacy_payload_ids(self):
        response = self.client.get(reverse("crm"))

        self.assertNotContains(response, 'id="contacts-data"')
        self.assertNotContains(response, 'id="detail-data"')
        self.assertNotContains(response, 'id="server-data"')
        self.assertNotContains(response, "crm/dashboard.js")

    def test_first_load_sets_csrf_cookie(self):
        response = self.client.get(reverse("crm"))
        self.assertIn("csrftoken", response.cookies)

    def test_inertia_visit_returns_json_page(self):
        response = self.inertia.get(reverse("crm"))

        self.assertEqual(response.headers["Content-Type"], "application/json")
        self.assertComponentUsed("crm/Dashboard")
        self.assertEqual(self.props()["contacts"][0]["name"], "One")
