"""CSV export behaviour."""

import csv
import io

from django.test import TestCase
from django.urls import reverse

from crm.models import Contact


class ExportContactsTests(TestCase):
    def test_export_csv_header_and_rows(self):
        Contact.objects.create(name="One", company="A")
        Contact.objects.create(name="Two", company="B")
        response = self.client.get(reverse("export_contacts"))
        self.assertEqual(response.status_code, 200)
        rows = list(csv.reader(io.StringIO(response.content.decode())))
        self.assertEqual(
            rows[0], ["Name", "Email", "Company", "Phone", "Status", "Owner", "Value"]
        )
        self.assertEqual(len(rows) - 1, Contact.objects.count())
