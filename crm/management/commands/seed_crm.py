from django.core.management.base import BaseCommand

from crm.models import Activity, Contact


class Command(BaseCommand):
    help = "Create sample CRM data"

    def handle(self, *args, **options):
        samples = [
            (
                "Aisha Rahman",
                "aisha@example.com",
                "Nusantara Health",
                "qualified",
                "Maya",
                18000,
            ),
            ("Ben Carter", "ben@example.com", "Carter Logistics", "lead", "Tom", 7500),
            (
                "Chandra Putri",
                "chandra@example.com",
                "Bali Solar",
                "customer",
                "Maya",
                32000,
            ),
            (
                "Dewi Santoso",
                "dewi@example.com",
                "Karya Retail",
                "inactive",
                "Rina",
                4000,
            ),
            (
                "Ethan Wong",
                "ethan@example.com",
                "Northstar Foods",
                "lead",
                "Rina",
                12500,
            ),
        ]
        for name, email, company, status, owner, value in samples:
            c, _ = Contact.objects.get_or_create(
                email=email,
                defaults={
                    "name": name,
                    "company": company,
                    "status": status,
                    "owner": owner,
                    "value": value,
                    "phone": "+62 555 0100",
                },
            )
            if not c.activities.exists():
                Activity.objects.create(
                    contact=c, body="Imported from old CRM", kind="system"
                )
        self.stdout.write(self.style.SUCCESS("Sample CRM data ready"))
