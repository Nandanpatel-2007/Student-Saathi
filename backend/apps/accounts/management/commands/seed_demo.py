"""Populate the database with a small, deterministic demo dataset.

    python manage.py seed_demo            # refuses to run twice
    python manage.py seed_demo --reset    # removes the previous demo data first

Everything created here is namespaced (usernames admin/faculty*/student*, subject codes DM-*,
department DM-CSE) so --reset never touches other data. All demo passwords are `demo1234`.
"""

import datetime as dt
import random

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.academics.models import Department, Enrollment, Section, Subject, TeachingAssignment
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User
from apps.assessments.models import Assessment, Mark
from apps.attendance.models import AttendanceRecord, AttendanceSession, AttendanceStatus

PASSWORD = "demo1234"
DEPARTMENT_CODE = "DM-CSE"
SECTION_PROGRAM = "B.Tech CSE (Demo)"
ACADEMIC_YEAR = "2025-2026"

SUBJECTS = [
    ("DM-CS301", "Data Structures", 4),
    ("DM-CS302", "Database Systems", 4),
    ("DM-CS303", "Operating Systems", 3),
    ("DM-MA301", "Discrete Mathematics", 3),
    ("DM-HS301", "Technical Communication", 2),
]
# faculty username -> subject codes taught (to both sections)
TEACHING = {
    "faculty1": ["DM-CS301", "DM-CS302"],
    "faculty2": ["DM-CS303", "DM-MA301"],
    "faculty3": ["DM-HS301"],
}
FACULTY_NAMES = {"faculty1": ("Anita", "Rao"), "faculty2": ("Vikram", "Shah"), "faculty3": ("Meera", "Iyer")}
FIRST = [
    "Aarav",
    "Diya",
    "Kabir",
    "Ishita",
    "Rohan",
    "Sneha",
    "Arjun",
    "Pooja",
    "Nikhil",
    "Riya",
    "Aditya",
    "Kavya",
    "Siddharth",
    "Ananya",
    "Manav",
]
LAST = ["Sharma", "Verma", "Gupta", "Nair", "Patel", "Reddy", "Singh", "Das", "Mehta", "Kapoor"]

ASSESSMENTS = [  # title, type, max, weightage, days after window start
    ("Quiz 1", "QUIZ", 20, 20, 14),
    ("Midterm", "MIDTERM", 50, 50, 28),
    ("Assignment 1", "ASSIGNMENT", 30, 30, 40),
]
WINDOW_DAYS = 41  # ~6 weeks of classes

# Deliberately at-risk students (usernames), see _profile().
LOW_ATTENDANCE = {"student03": 0.45}
WARNING_ATTENDANCE = {"student18": 0.22}
FAILING = {"student07", "student25"}
LOW_AND_FAILING = {"student25": 0.40}
SHARP_DROP = {"student12": [82, 86, 52]}
ABSENT_FOR_MIDTERM = {"student09"}


def demo_usernames():
    return ["admin", *TEACHING, *[f"student{i:02d}" for i in range(1, 31)]]


class Command(BaseCommand):
    help = "Seed demo data: 1 admin, 3 faculty, 2 sections, 30 students, 5 subjects, 6 weeks of data."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete previous demo data first")

    @transaction.atomic
    def handle(self, *args, **options):
        if User.objects.filter(username="admin").exists():
            if not options["reset"]:
                raise CommandError("Demo data already exists. Re-run with --reset to replace it.")
            self._wipe()
        rng = random.Random(42)
        self._seed(rng)

    # ------------------------------------------------------------------ wipe

    def _wipe(self):
        users = User.objects.filter(username__in=demo_usernames())
        assignments = TeachingAssignment.objects.filter(subject__code__startswith="DM-")
        AttendanceSession.objects.filter(teaching_assignment__in=assignments).delete()
        Assessment.objects.filter(teaching_assignment__in=assignments).delete()
        assignments.delete()
        Enrollment.objects.filter(subject__code__startswith="DM-").delete()
        users.delete()
        Subject.objects.filter(code__startswith="DM-").delete()
        Section.objects.filter(program=SECTION_PROGRAM).delete()
        Department.objects.filter(code=DEPARTMENT_CODE).delete()

    # ------------------------------------------------------------------ seed

    def _seed(self, rng: random.Random):
        password_hash = make_password(PASSWORD)

        def make_user(username, role, first, last, **extra):
            return User(
                username=username,
                email=f"{username}@demo.test",
                first_name=first,
                last_name=last,
                role=role,
                password=password_hash,
                **extra,
            )

        admin = make_user("admin", Role.ADMIN, "Asha", "Admin", is_staff=True, is_superuser=True)
        admin.save()

        dept = Department.objects.create(name="Computer Science (Demo)", code=DEPARTMENT_CODE)
        faculty = {}
        for i, (username, (first, last)) in enumerate(FACULTY_NAMES.items(), start=1):
            user = make_user(username, Role.FACULTY, first, last)
            user.save()
            faculty[username] = (
                user,
                FacultyProfile.objects.create(user=user, employee_id=f"DMF{i:03d}", department=dept),
            )

        sections = [
            Section.objects.create(
                name=name, program=SECTION_PROGRAM, semester=3, academic_year=ACADEMIC_YEAR
            )
            for name in ("A", "B")
        ]
        subjects = {
            code: Subject.objects.create(code=code, name=name, credits=credits, semester=3)
            for code, name, credits in SUBJECTS
        }

        students = []
        for n in range(1, 31):
            section = sections[0] if n <= 15 else sections[1]
            user = make_user(f"student{n:02d}", Role.STUDENT, FIRST[(n - 1) % 15], LAST[(n * 7) % 10])
            user.save()
            students.append(
                StudentProfile.objects.create(
                    user=user, roll_no=f"CSE{section.name}{n:03d}", section=section, admission_year=2024
                )
            )
        Enrollment.objects.bulk_create(
            Enrollment(student=s, subject=sub) for s in students for sub in subjects.values()
        )

        today = timezone.localdate()
        start = today - dt.timedelta(days=WINDOW_DAYS)
        assignments = []
        for username, codes in TEACHING.items():
            for code in codes:
                for section in sections:
                    assignments.append(
                        TeachingAssignment.objects.create(
                            faculty=faculty[username][1], subject=subjects[code], section=section
                        )
                    )

        subject_order = {code: i for i, (code, _, _) in enumerate(SUBJECTS)}
        for assignment in assignments:
            owner = assignment.faculty.user
            roster = [s for s in students if s.section_id == assignment.section_id]
            self._seed_attendance(
                rng, assignment, owner, roster, start, today, subject_order[assignment.subject.code]
            )
            self._seed_assessments(rng, assignment, roster, start)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded 1 admin, {len(faculty)} faculty, {len(sections)} sections, "
                f"{len(students)} students, {len(subjects)} subjects, {len(assignments)} classes."
            )
        )
        self.stdout.write(f"Logins (password '{PASSWORD}'): admin, faculty1-3, student01-30")
        self.stdout.write(
            "At-risk students: student03 (low attendance), student18 (attendance warning), "
            "student07 (failing), student12 (sharp score drop), student25 (low attendance + failing)"
        )

    def _seed_attendance(self, rng, assignment, owner, roster, start, today, subject_index):
        weekdays = {(subject_index + k) % 5 for k in (0, 2, 4)}
        dates = [start + dt.timedelta(days=d) for d in range(WINDOW_DAYS + 1)]
        dates = [d for d in dates if d.weekday() in weekdays]
        now = timezone.now()
        sessions = AttendanceSession.objects.bulk_create(
            AttendanceSession(
                teaching_assignment=assignment,
                date=d,
                period=subject_index + 1,
                topic=f"Lecture {i}",
                created_by=owner,
                created_at=now,
                updated_at=now,
            )
            for i, d in enumerate(dates, start=1)
        )
        records = []
        for student in roster:
            username = student.user.username
            special = {**LOW_ATTENDANCE, **WARNING_ATTENDANCE, **LOW_AND_FAILING}.get(username)
            absent_rate = special if special is not None else rng.uniform(0.0, 0.12)
            absent_idx = set(rng.sample(range(len(sessions)), round(absent_rate * len(sessions))))
            for i, session in enumerate(sessions):
                if i in absent_idx:
                    status = AttendanceStatus.ABSENT
                elif special is not None:
                    status = AttendanceStatus.PRESENT  # keep at-risk percentages predictable
                else:
                    roll = rng.random()
                    status = (
                        AttendanceStatus.LATE
                        if roll < 0.05
                        else AttendanceStatus.EXCUSED
                        if roll < 0.08
                        else AttendanceStatus.PRESENT
                    )
                records.append(
                    AttendanceRecord(
                        session=session, student=student, status=status, updated_by=owner, updated_at=now
                    )
                )
        AttendanceRecord.objects.bulk_create(records)

    def _seed_assessments(self, rng, assignment, roster, start):
        assessments = [
            Assessment.objects.create(
                teaching_assignment=assignment,
                title=title,
                type=kind,
                max_marks=max_marks,
                weightage_percent=weight,
                date=start + dt.timedelta(days=offset),
            )
            for title, kind, max_marks, weight, offset in ASSESSMENTS
        ]
        marks = []
        for student in roster:
            username = student.user.username
            ability = 28 if (username in FAILING or username in LOW_AND_FAILING) else rng.uniform(55, 90)
            for index, assessment in enumerate(assessments):
                if username in ABSENT_FOR_MIDTERM and assessment.type == "MIDTERM":
                    marks.append(Mark(assessment=assessment, student=student, is_absent=True))
                    continue
                if username in SHARP_DROP:
                    pct = SHARP_DROP[username][index]
                else:
                    pct = min(max(ability + rng.gauss(0, 6), 5), 100)
                obtained = round(pct / 100 * float(assessment.max_marks) * 2) / 2
                marks.append(Mark(assessment=assessment, student=student, marks_obtained=obtained))
        Mark.objects.bulk_create(marks)
