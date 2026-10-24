from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=20, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Section(models.Model):
    name = models.CharField(max_length=50)
    program = models.CharField(max_length=100)
    semester = models.PositiveSmallIntegerField()
    academic_year = models.CharField(max_length=9, help_text="e.g. 2025-2026")

    class Meta:
        ordering = ["academic_year", "program", "semester", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "program", "semester", "academic_year"],
                name="uniq_section_identity",
            )
        ]

    def __str__(self):
        return f"{self.program} Sem {self.semester} - {self.name} ({self.academic_year})"


class Subject(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=150)
    credits = models.PositiveSmallIntegerField()
    semester = models.PositiveSmallIntegerField(db_index=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Enrollment(models.Model):
    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="enrollments"
    )
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="enrollments")

    class Meta:
        ordering = ["subject__code", "student__roll_no"]
        constraints = [
            models.UniqueConstraint(fields=["student", "subject"], name="uniq_enrollment_student_subject")
        ]

    def __str__(self):
        return f"{self.student_id} -> {self.subject_id}"


class TeachingAssignment(models.Model):
    faculty = models.ForeignKey(
        "accounts.FacultyProfile", on_delete=models.PROTECT, related_name="teaching_assignments"
    )
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="teaching_assignments")
    section = models.ForeignKey(Section, on_delete=models.PROTECT, related_name="teaching_assignments")

    class Meta:
        ordering = ["subject__code", "section__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["faculty", "subject", "section"], name="uniq_assignment_faculty_subject_section"
            )
        ]

    def __str__(self):
        return f"{self.faculty_id} teaches {self.subject_id} to {self.section_id}"
