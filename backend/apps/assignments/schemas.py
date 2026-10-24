import datetime as dt
from decimal import Decimal

from ninja import Field, Schema

from apps.academics.schemas import SectionOut, StudentBrief, SubjectOut


class AssignmentFields(Schema):
    title: str = Field(..., min_length=1, max_length=150)
    description: str = Field("", max_length=5000)
    due_at: dt.datetime = Field(
        ...,
        description="ISO 8601 with an offset (e.g. 2025-10-31T17:00:00+05:30). Without one, IST is assumed.",
    )
    max_marks: Decimal = Field(..., gt=0, max_digits=6, decimal_places=2)
    allow_late_submissions: bool = True


class AssignmentCreateIn(AssignmentFields):
    teaching_assignment_id: int


class AssignmentUpdateIn(AssignmentFields):
    pass


class AssignmentOut(Schema):
    id: int
    teaching_assignment_id: int
    subject: SubjectOut
    section: SectionOut
    title: str
    description: str
    created_at: dt.datetime
    due_at: dt.datetime
    max_marks: float
    allow_late_submissions: bool
    total_students: int = Field(..., description="Students enrolled in this class")
    submitted_count: int
    late_count: int = Field(..., description="Submissions made after the current due date")
    graded_count: int

    @staticmethod
    def resolve_subject(obj):
        return obj.teaching_assignment.subject

    @staticmethod
    def resolve_section(obj):
        return obj.teaching_assignment.section


class SubmissionSummaryOut(Schema):
    original_name: str
    size: int
    note: str
    submitted_at: dt.datetime


class StudentAssignmentOut(Schema):
    assignment_id: int
    teaching_assignment_id: int
    title: str
    description: str
    subject: SubjectOut
    section: SectionOut
    due_at: dt.datetime
    max_marks: float
    allow_late_submissions: bool
    status: str = Field(..., description="NOT_SUBMITTED | SUBMITTED | LATE | GRADED | OVERDUE_MISSING")
    timing: str | None = Field(None, description="ON_TIME | LATE once something is submitted")
    offset_seconds: int | None = Field(
        None, description="Submission time minus the current due date; negative = before the deadline"
    )
    submission: SubmissionSummaryOut | None = None
    marks_obtained: float | None = None
    feedback: str = ""
    graded_at: dt.datetime | None = None


class SubmissionRowOut(Schema):
    student: StudentBrief
    status: str
    timing: str | None = None
    offset_seconds: int | None = None
    submitted_at: dt.datetime | None = None
    original_name: str | None = None
    size: int | None = None
    note: str = ""
    marks_obtained: float | None = None
    feedback: str = ""
    graded_at: dt.datetime | None = None


class GradeIn(Schema):
    marks_obtained: Decimal = Field(..., ge=0, max_digits=6, decimal_places=2)
    feedback: str = Field("", max_length=2000)
