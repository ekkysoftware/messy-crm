from django.urls import path

from . import views

urlpatterns = [
    path("", views.crm_screen, name="crm"),
    path("contacts/", views.create_contact_view, name="create_contact"),
    path("contacts/<int:pk>/", views.delete_contact_view, name="delete_contact"),
    path(
        "contacts/<int:pk>/status/",
        views.update_contact_status,
        name="update_contact_status",
    ),
    path(
        "contacts/<int:pk>/notes/",
        views.add_contact_note,
        name="add_contact_note",
    ),
    path("export/", views.export_contacts, name="export_contacts"),
]
