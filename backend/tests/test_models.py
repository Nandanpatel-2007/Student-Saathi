import pytest
from django.db import IntegrityError, transaction
from django.utils.module_loading import import_string

from apps.accounts.models import FacultyProfile, Role, StudentProfile, User


def test_custom_user_model_configured():
    from django.conf import settings

    assert settings.AUTH_USER_MODEL == "accounts.User"
    assert import_string("apps.accounts.models.User") is User


def test_default_role_is_student(db):
    assert User.objects.create_user("u", password="x").role == Role.STUDENT


def test_superuser_is_forced_to_admin(db):
    assert User.objects.create_superuser("root", password="x").role == Role.ADMIN


def test_student_roll_no_unique(student_user, section, db):
    other = User.objects.create_user("stu2", password="x")
    with pytest.raises(IntegrityError), transaction.atomic():
        StudentProfile.objects.create(user=other, roll_no="R001", section=section, admission_year=2024)


def test_faculty_employee_id_unique(faculty_user, department, db):
    other = User.objects.create_user("fac2", password="x", role=Role.FACULTY)
    with pytest.raises(IntegrityError), transaction.atomic():
        FacultyProfile.objects.create(user=other, employee_id="E001", department=department)
