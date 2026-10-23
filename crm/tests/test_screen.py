"""Read-side behaviour of the CRM dashboard screen."""

from django.test import TestCase
from django.urls import reverse

from crm.models import Contact


class CrmScreenTests(TestCase):
    def setUp(self):
        self.contact = Contact.objects.create(
            name="Ekky Example",
            email="ekky@example.com",
            company="Altogether",
            status="lead",
            value=1000,
        )

    def test_dashboard_loads(self):
        response = self.client.get(reverse("crm"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Jellybean CRM")

    def test_search(self):
        Contact.objects.create(name="Someone Else", company="Other")
        response = self.client.get(reverse("crm"), {"q": "Altogether"})
        self.assertContains(response, "Ekky Example")
        self.assertNotContains(response, "Someone Else")

    def test_status_filter(self):
        Contact.objects.create(name="Someone Else", company="Other", status="customer")
        response = self.client.get(reverse("crm"), {"status": "lead"})
        self.assertContains(response, "Ekky Example")
        self.assertNotContains(response, "Someone Else")
