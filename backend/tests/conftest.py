import pytest
from django.test import Client

from apps.academics.models import Department, Section
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User

PASSWORD = "S3cret-pass!"


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def department(db):
    return Department.objects.create(name="Computer Science", code="CS")


@pytest.fixture
def section(db):
    return Section.objects.create(name="A", program="B.Tech", semester=3, academic_year="2025-2026")


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        "admin1", password=PASSWORD, role=Role.ADMIN, first_name="Ada", last_name="Min"
    )


@pytest.fixture
def faculty_user(db, department):
    user = User.objects.create_user(
        "fac1", password=PASSWORD, role=Role.FACULTY, first_name="Fay", last_name="Culty"
    )
    FacultyProfile.objects.create(user=user, employee_id="E001", department=department)
    return user


@pytest.fixture
def student_user(db, section):
    user = User.objects.create_user(
        "stu1", password=PASSWORD, role=Role.STUDENT, first_name="Stu", last_name="Dent"
    )
    StudentProfile.objects.create(user=user, roll_no="R001", section=section, admission_year=2024)
    return user


def login(client, username, password=PASSWORD):
    return client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
        content_type="application/json",
    )


def auth_header(client, username):
    token = login(client, username).json()["access"]
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}
