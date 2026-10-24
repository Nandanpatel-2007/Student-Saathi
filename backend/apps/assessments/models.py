from django.db import models
from django.utils import timezone


class AssessmentType(models.TextChoices):
    QUIZ = "QUIZ", "Quiz"
    MIDTERM = "MIDTERM", "Midterm"
    ASSIGNMENT = "ASSIGNMENT", "Assignment"
    PRACTICAL = "PRACTICAL", "Practical"
    OTHER = "OTHER", "Other"


class Assessment(models.Model):
    teaching_assignment = models.ForeignKey(
        "academics.TeachingAssignment", on_delete=models.PROTECT, related_name="assessments"
    )
    title = models.CharField(max_length=150)
    type = models.CharField(max_length=12, choices=AssessmentType.choices, default=AssessmentType.OTHER)
    max_marks = models.DecimalField(max_digits=6, decimal_places=2)
    weightage_percent = models.DecimalField(max_digits=5, decimal_places=2)
    date = models.DateField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["date", "id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(max_marks__gt=0), name="assessment_max_marks_positive"),
            models.CheckConstraint(
                condition=models.Q(weightage_percent__gte=0, weightage_percent__lte=100),
                name="assessment_weightage_0_100",
            ),
        ]
        indexes = [models.Index(fields=["teaching_assignment", "date"], name="assess_assignment_date_idx")]

    def __str__(self):
        return f"{self.title} ({self.teaching_assignment_id})"


class Mark(models.Model):
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="marks")
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="marks")
    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    is_absent = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["assessment", "student"], name="uniq_mark_assessment_student"),
            models.CheckConstraint(
                condition=models.Q(is_absent=False) | models.Q(marks_obtained__isnull=True),
                name="mark_absent_has_no_marks",
            ),
        ]
        indexes = [models.Index(fields=["student"], name="mark_student_idx")]

    def __str__(self):
        return f"{self.assessment_id}/{self.student_id}"
