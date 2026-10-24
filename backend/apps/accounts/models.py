from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    STUDENT = "STUDENT", "Student"
    FACULTY = "FACULTY", "Faculty"
    ADMIN = "ADMIN", "Admin"


class User(AbstractUser):
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT, db_index=True)

    @property
    def display_name(self) -> str:
        return self.get_full_name() or self.get_username()

    def save(self, *args, **kwargs):
        # Superusers are always admins, so role checks and Django admin agree.
        if self.is_superuser:
            self.role = Role.ADMIN
        super().save(*args, **kwargs)


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    roll_no = models.CharField(max_length=30, unique=True)
    section = models.ForeignKey("academics.Section", on_delete=models.PROTECT, related_name="students")
    admission_year = models.PositiveSmallIntegerField()

    def __str__(self):
        return f"{self.roll_no} ({self.user})"


class FacultyProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="faculty_profile")
    employee_id = models.CharField(max_length=30, unique=True)
    department = models.ForeignKey("academics.Department", on_delete=models.PROTECT, related_name="faculty")

    def __str__(self):
        return f"{self.employee_id} ({self.user})"
