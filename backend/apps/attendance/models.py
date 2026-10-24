from django.conf import settings
from django.db import models
from django.utils import timezone


class AttendanceStatus(models.TextChoices):
    PRESENT = "PRESENT", "Present"
    ABSENT = "ABSENT", "Absent"
    LATE = "LATE", "Late"
    EXCUSED = "EXCUSED", "Excused"


class AttendanceSession(models.Model):
    teaching_assignment = models.ForeignKey(
        "academics.TeachingAssignment", on_delete=models.PROTECT, related_name="attendance_sessions"
    )
    date = models.DateField()
    period = models.PositiveSmallIntegerField(help_text="Timetable slot within the day")
    topic = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-date", "period"]
        constraints = [
            models.UniqueConstraint(
                fields=["teaching_assignment", "date", "period"], name="uniq_session_assignment_date_period"
            )
        ]
        indexes = [models.Index(fields=["date"], name="att_session_date_idx")]

    def __str__(self):
        return f"{self.teaching_assignment_id} {self.date} P{self.period}"


class AttendanceRecord(models.Model):
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name="records")
    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="attendance_records"
    )
    status = models.CharField(
        max_length=10, choices=AttendanceStatus.choices, default=AttendanceStatus.PRESENT
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["session", "student"], name="uniq_record_session_student")
        ]
        indexes = [models.Index(fields=["student", "status"], name="att_record_student_status_idx")]

    def __str__(self):
        return f"{self.session_id}/{self.student_id}: {self.status}"


class AttendanceAuditLog(models.Model):
    """One row per status change made after the session was created."""

    record = models.ForeignKey(AttendanceRecord, on_delete=models.CASCADE, related_name="audit_logs")
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name="audit_logs")
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="+")
    old_status = models.CharField(max_length=10, choices=AttendanceStatus.choices)
    new_status = models.CharField(max_length=10, choices=AttendanceStatus.choices)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    changed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-changed_at", "-id"]
        indexes = [models.Index(fields=["session", "changed_at"], name="att_audit_session_idx")]

    def __str__(self):
        return f"{self.session_id}/{self.student_id}: {self.old_status} -> {self.new_status}"
