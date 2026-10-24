from django.apps import AppConfig


class AssignmentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.assignments"

    def ready(self):
        from . import signals  # noqa: F401  (registers file cleanup)
