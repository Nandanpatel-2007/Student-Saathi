import datetime as dt
from decimal import Decimal

from ninja import Field, Schema

from apps.academics.schemas import SectionOut, StudentBrief, SubjectOut

from .models import AssessmentType


class AssessmentFields(Schema):
    title: str = Field(..., min_length=1, max_length=150)
    type: AssessmentType
    max_marks: Decimal = Field(..., gt=0, max_digits=6, decimal_places=2)
    date: dt.date


class AssessmentCreateIn(AssessmentFields):
    teaching_assignment_id: int


class AssessmentUpdateIn(AssessmentFields):
    pass


class AssessmentOut(Schema):
    id: int
    teaching_assignment_id: int
    subject: SubjectOut
    section: SectionOut
    title: str
    type: AssessmentType
    max_marks: float
    date: dt.date

    @staticmethod
    def resolve_subject(obj):
        return obj.teaching_assignment.subject

    @staticmethod
    def resolve_section(obj):
        return obj.teaching_assignment.section


class MarkIn(Schema):
    student_id: int = Field(..., description="StudentProfile id")
    marks_obtained: Decimal | None = Field(None, ge=0, max_digits=6, decimal_places=2)
    is_absent: bool = False


class MarksUpdateIn(Schema):
    marks: list[MarkIn] = Field(..., min_length=1)


class MarkOut(Schema):
    student: StudentBrief
    marks_obtained: float | None = None
    is_absent: bool = False


class MarksSheetOut(Schema):
    assessment: AssessmentOut
    marks: list[MarkOut]
