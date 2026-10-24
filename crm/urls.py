from django.urls import path

from .views import *

# `ContactView` serves one verb per route, so each route pins the verb it
# answers; that keeps the URL contract from widening when the view gains a
# handler.
urlpatterns = [
    path("", ContactView.as_view(http_method_names=["get"]), name="crm"),
    path(
        "contacts/",
        ContactView.as_view(http_method_names=["post"]),
        name="create_contact",
    ),
    path(
        "contacts/<int:pk>/",
        ContactView.as_view(http_method_names=["delete"]),
        name="delete_contact",
    ),
    path(
        "contacts/<int:pk>/status/",
        ContactView.as_view(http_method_names=["patch"]),
        name="update_contact_status",
    ),
    path(
        "contacts/<int:pk>/notes/",
        AddContactNoteView.as_view(),
        name="add_contact_note",
    ),
    path("export/", ExportContactsView.as_view(), name="export_contacts"),
]
