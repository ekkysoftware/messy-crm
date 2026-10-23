"""Query-count guardrails for the dashboard screen."""

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from crm.models import Contact


class DashboardQueryCountTests(TestCase):
    def _dashboard_query_count(self):
        with CaptureQueriesContext(connection) as captured:
            response = self.client.get(reverse("crm"))
        self.assertEqual(response.status_code, 200)
        return len(captured)

    def test_home_query_count_is_capped(self):
        Contact.objects.create(name="One")
        with self.assertNumQueries(5):
            self.client.get(reverse("crm"))

    def test_home_query_count_does_not_grow_with_contacts(self):
        Contact.objects.create(name="One")
        base = self._dashboard_query_count()
        for i in range(10):
            Contact.objects.create(name=f"Extra {i}")
        self.assertEqual(self._dashboard_query_count(), base)
