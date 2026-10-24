from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import UserManager as DjangoUserManager
from django.db import models


class Role(models.TextChoices):
    STUDENT = "STUDENT", "Student"
    FACULTY = "FACULTY", "Faculty"
    ADMIN = "ADMIN", "Admin"


class UserManager(DjangoUserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", Role.ADMIN)
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)

    objects = UserManager()

    class Meta:
        indexes = [models.Index(fields=["role"])]

    @property
    def display_name(self) -> str:
        return self.get_full_name() or self.username


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    roll_no = models.CharField(max_length=32, unique=True)
    section = models.ForeignKey(
        "academics.Section", on_delete=models.PROTECT, related_name="students"
    )
    admission_year = models.PositiveSmallIntegerField()

    def __str__(self) -> str:
        return f"{self.roll_no} - {self.user.display_name}"


class FacultyProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="faculty_profile")
    employee_id = models.CharField(max_length=32, unique=True)
    department = models.ForeignKey(
        "academics.Department", on_delete=models.PROTECT, related_name="faculty"
    )

    def __str__(self) -> str:
        return f"{self.employee_id} - {self.user.display_name}"
