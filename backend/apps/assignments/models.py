from django.conf import settings
from django.db import models
from django.utils import timezone


def submission_upload_to(instance: "Submission", filename: str) -> str:
    """Stored path: assignments/<assignment id>/<random name> (the name is generated, not user-supplied)."""
    return f"assignments/{instance.assignment_id}/{filename}"


class Assignment(models.Model):
    teaching_assignment = models.ForeignKey(
        "academics.TeachingAssignment", on_delete=models.PROTECT, related_name="assignments"
    )
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)
    due_at = models.DateTimeField(help_text="Stored in UTC; displayed in the project time zone")
    max_marks = models.DecimalField(max_digits=6, decimal_places=2)
    allow_late_submissions = models.BooleanField(default=True)

    class Meta:
        ordering = ["due_at", "id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(max_marks__gt=0), name="assignment_max_marks_positive"),
        ]
        indexes = [models.Index(fields=["teaching_assignment", "due_at"], name="assignment_class_due_idx")]

    def __str__(self):
        return f"{self.title} ({self.teaching_assignment_id})"


class Submission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="submissions")
    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="submissions"
    )
    file = models.FileField(upload_to=submission_upload_to, max_length=255)
    original_name = models.CharField(max_length=255)
    size = models.PositiveIntegerField()
    content_type = models.CharField(max_length=100, blank=True)
    note = models.CharField(max_length=500, blank=True)
    submitted_at = models.DateTimeField(
        default=timezone.now, help_text="Set by the server on every (re)submission"
    )
    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    feedback = models.TextField(blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "student"], name="uniq_submission_assignment_student"
            ),
            models.CheckConstraint(
                condition=models.Q(marks_obtained__isnull=True) | models.Q(marks_obtained__gte=0),
                name="submission_marks_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["assignment", "submitted_at"], name="submission_assign_time_idx"),
            models.Index(fields=["student"], name="submission_student_idx"),
        ]

    def __str__(self):
        return f"{self.assignment_id}/{self.student_id}"

    @property
    def is_graded(self) -> bool:
        return self.marks_obtained is not None
