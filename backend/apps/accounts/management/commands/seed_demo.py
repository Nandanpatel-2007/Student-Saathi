"""Populate the database with a small, deterministic demo dataset.

    python manage.py seed_demo            # refuses to run twice
    python manage.py seed_demo --reset    # removes the previous demo data first

Everything created here is namespaced (usernames admin/faculty*/student*, subject codes DM-*,
department DM-CSE) so --reset never touches other data. All demo passwords are `demo1234`.
"""

import datetime as dt
import random
import uuid

from django.contrib.auth.hashers import make_password
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.academics.models import Department, Enrollment, Section, Subject, TeachingAssignment
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User
from apps.assessments.models import Assessment, Mark
from apps.assignments.models import Assignment, Submission
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

ASSESSMENTS = [  # title, type, max marks, days after window start
    ("Quiz 1", "QUIZ", 20, 14),
    ("Midterm", "MIDTERM", 50, 28),
    ("Assignment 1", "ASSIGNMENT", 30, 40),
]
WINDOW_DAYS = 41  # ~6 weeks of classes

# title, max marks, days from today the work is (was) due, allows late submissions, graded share
ASSIGNMENTS = [
    ("Problem Set 1", 20, -20, True, 1.0),  # long past: everything submitted is graded
    ("Problem Set 2", 25, -8, False, 0.5),  # strict deadline; about half graded
    ("Mini Project Proposal", 40, 5, True, 0.0),  # upcoming: a few early birds, nothing graded
]
FEEDBACK = {
    "high": "Excellent work: clear reasoning and well presented.",
    "mid": "Good effort. Tighten the explanation in the later questions.",
    "low": "Needs more depth. Please see me during office hours.",
}

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
        # Deleting the assignments cascades to their submissions; a signal removes the stored files.
        Assignment.objects.filter(teaching_assignment__in=assignments).delete()
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
            self._seed_assignments(assignment, owner, roster)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded 1 admin, {len(faculty)} faculty, {len(sections)} sections, "
                f"{len(students)} students, {len(subjects)} subjects, {len(assignments)} classes, "
                f"{Assignment.objects.count()} assignments with {Submission.objects.count()} submissions."
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
                date=start + dt.timedelta(days=offset),
            )
            for title, kind, max_marks, offset in ASSESSMENTS
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

    def _seed_assignments(self, ta, owner, roster):
        """Three assignments per class with a realistic spread of submission timings and grades."""
        rng = random.Random(f"assignments-{ta.subject.code}-{ta.section.name}")  # stable across resets
        now = timezone.now()
        for title, max_marks, due_offset, allow_late, graded_share in ASSIGNMENTS:
            due_day = timezone.localdate() + dt.timedelta(days=due_offset)
            due_at = timezone.make_aware(dt.datetime.combine(due_day, dt.time(17, 0)))
            work = Assignment.objects.create(
                teaching_assignment=ta,
                title=title,
                description=f"{title} for {ta.subject.name}. Upload a PDF.",
                created_by=owner,
                created_at=due_at - dt.timedelta(days=12),
                due_at=due_at,
                max_marks=max_marks,
                allow_late_submissions=allow_late,
            )
            upcoming = due_at > now
            for student in roster:
                username = student.user.username
                scenario = self._scenario(rng, username, upcoming, allow_late)
                if scenario == "missing":
                    continue
                submitted_at = self._submitted_at(rng, scenario, due_at, now)
                submission = Submission(
                    assignment=work,
                    student=student,
                    original_name=f"{username}_{title.lower().replace(' ', '_')}.pdf",
                    note="" if rng.random() < 0.7 else "Please check question 3.",
                    submitted_at=submitted_at,
                )
                pdf = make_pdf(f"{title} - {username}")
                submission.size = len(pdf)
                submission.content_type = "application/pdf"
                submission.file.save(f"{uuid.uuid4().hex}.pdf", ContentFile(pdf), save=False)
                if rng.random() < graded_share:
                    pct = self._assignment_percent(rng, username)
                    submission.marks_obtained = round(pct / 100 * max_marks * 2) / 2
                    submission.feedback = FEEDBACK["high" if pct >= 80 else "mid" if pct >= 60 else "low"]
                    submission.graded_at = min(
                        now, submitted_at + dt.timedelta(days=1, hours=rng.randint(0, 8))
                    )
                    submission.graded_by = owner
                submission.save()

    @staticmethod
    def _scenario(rng, username, upcoming, allow_late):
        if username == "student12":
            return "early" if upcoming else "ontime"  # keeps this student's sharp-drop story intact
        roll = rng.random()
        if upcoming:
            return "early" if roll < 0.25 else "missing"
        if roll < 0.25:
            return "early"
        if roll < 0.60:
            return "ontime"
        if roll < 0.80:
            return "late" if allow_late else "missing"
        return "missing"

    @staticmethod
    def _submitted_at(rng, scenario, due_at, now):
        if scenario == "early":
            when = due_at - dt.timedelta(days=2, hours=rng.randint(0, 20), minutes=rng.randint(0, 59))
        elif scenario == "ontime":
            when = due_at - dt.timedelta(minutes=rng.randint(5, 240))
        else:  # late: hours to a few days after
            when = due_at + dt.timedelta(hours=rng.randint(1, 70), minutes=rng.randint(0, 59))
        return min(when, now - dt.timedelta(minutes=1))

    @staticmethod
    def _assignment_percent(rng, username):
        if username in FAILING or username in LOW_AND_FAILING:
            ability = 28
        elif username in SHARP_DROP:
            ability = 90  # high marks keep the later fall to the final assessment a sharp drop
        else:
            ability = rng.uniform(55, 90)
        return min(max(ability + rng.gauss(0, 6), 5), 100)


def make_pdf(text: str) -> bytes:
    """A tiny but valid single-page PDF, so demo downloads open in any viewer (no binary fixtures)."""
    safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT /F1 12 Tf 20 50 Td ({safe}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode() + b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n".encode()
    return bytes(out)
