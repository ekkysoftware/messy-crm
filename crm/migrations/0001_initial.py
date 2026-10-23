import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Contact",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=200)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("company", models.CharField(blank=True, max_length=200)),
                ("phone", models.CharField(blank=True, max_length=50)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("lead", "Lead"),
                            ("qualified", "Qualified"),
                            ("customer", "Customer"),
                            ("inactive", "Inactive"),
                        ],
                        default="lead",
                        max_length=30,
                    ),
                ),
                ("owner", models.CharField(blank=True, max_length=120)),
                (
                    "value",
                    models.DecimalField(decimal_places=2, default=0, max_digits=12),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="Activity",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("kind", models.CharField(default="note", max_length=40)),
                ("body", models.TextField()),
                (
                    "created_by",
                    models.CharField(default="Interview User", max_length=120),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "contact",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activities",
                        to="crm.contact",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
