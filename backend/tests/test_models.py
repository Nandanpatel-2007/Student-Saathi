import pytest
from django.db import IntegrityError, transaction

from apps.accounts.models import FacultyProfile, Role, StudentProfile, User

pytestmark = pytest.mark.django_db


def test_user_defaults_to_student_role():
    assert User.objects.create_user("u", password="x").role == Role.STUDENT


def test_createsuperuser_gets_admin_role():
    assert User.objects.create_superuser("root", password="x").role == Role.ADMIN


def test_student_roll_no_is_unique(student_user, make_user, section):
    other = make_user("stu2", Role.STUDENT)
    with pytest.raises(IntegrityError), transaction.atomic():
        StudentProfile.objects.create(
            user=other, roll_no="R001", section=section, admission_year=2024
        )


def test_faculty_employee_id_is_unique(faculty_user, make_user, department):
    other = make_user("fac2", Role.FACULTY)
    with pytest.raises(IntegrityError), transaction.atomic():
        FacultyProfile.objects.create(user=other, employee_id="E001", department=department)
