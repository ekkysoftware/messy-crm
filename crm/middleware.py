"""Inertia-specific middleware for the CRM app."""

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from inertia.share import share

SESSION_ERRORS_KEY = "inertia_errors"


def flash_errors(request: HttpRequest, errors: dict[str, str]) -> None:
    """Store validation errors for the next dashboard response only."""
    request.session[SESSION_ERRORS_KEY] = errors


def _first_errors(form) -> dict[str, str]:
    """Flatten a Django form's errors to one message per field."""
    return {
        field: entries[0]["message"]
        for field, entries in form.errors.get_json_data().items()
    }


class ShareInertiaErrorsMiddleware:
    """Expose one-shot validation errors to the next Inertia page as a prop.

    A rejected command stores errors in the session and redirects, so the
    dashboard URL stays authoritative. This middleware consumes them and
    merges them into the page props under ``errors``; the following request no
    longer sees them.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        errors = request.session.pop(SESSION_ERRORS_KEY, None)
        if errors:
            share(request, errors=errors)
        return self.get_response(request)
