from django.db import models


class Contact(models.Model):
    STATUS_CHOICES = [
        ("lead", "Lead"),
        ("qualified", "Qualified"),
        ("customer", "Customer"),
        ("inactive", "Inactive"),
    ]
    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    company = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="lead")
    owner = models.CharField(max_length=120, blank=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Activity(models.Model):
    contact = models.ForeignKey(
        Contact, on_delete=models.CASCADE, related_name="activities"
    )
    kind = models.CharField(max_length=40, default="note")
    body = models.TextField()
    created_by = models.CharField(max_length=120, default="Interview User")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
