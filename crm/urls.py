from django.urls import path

from .views import *

# Both names address the same detail endpoint. `update_contact` is the
# current name; `delete_contact` remains as an alias for existing clients.
contact_detail = ContactDetailView.as_view(http_method_names=["delete", "patch"])

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
    path("contacts/<int:pk>/", contact_detail, name="update_contact"),
    path("contacts/<int:pk>/", contact_detail, name="delete_contact"),
    path(
        "contacts/status/",
        BulkStatusView.as_view(http_method_names=["post"]),
        name="bulk_update_contact_status",
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
