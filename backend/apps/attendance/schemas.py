import datetime as dt

from ninja import Field, Schema

from apps.academics.schemas import SectionOut, StudentBrief, SubjectOut

from .models import AttendanceStatus


class SessionCreateIn(Schema):
    teaching_assignment_id: int
    date: dt.date
    period: int = Field(..., ge=1, le=12)
    topic: str = Field("", max_length=200)


class RecordUpdateItem(Schema):
    student_id: int = Field(..., description="StudentProfile id")
    status: AttendanceStatus


class RecordsUpdateIn(Schema):
    records: list[RecordUpdateItem] = Field(..., min_length=1)


class RecordOut(Schema):
    student: StudentBrief
    status: AttendanceStatus
    updated_at: dt.datetime
    updated_by_name: str | None = None

    @staticmethod
    def resolve_updated_by_name(obj):
        return obj.updated_by.display_name if obj.updated_by else None


class SessionBase(Schema):
    id: int
    teaching_assignment_id: int
    subject: SubjectOut
    section: SectionOut
    date: dt.date
    period: int
    topic: str
    present: int = Field(..., description="Records with status PRESENT")
    absent: int
    late: int
    excused: int
    total: int
    updated_at: dt.datetime
    updated_by_name: str | None = None

    @staticmethod
    def resolve_subject(obj):
        return obj.teaching_assignment.subject

    @staticmethod
    def resolve_section(obj):
        return obj.teaching_assignment.section

    @staticmethod
    def resolve_updated_by_name(obj):
        return obj.updated_by.display_name if obj.updated_by else None


class SessionOut(SessionBase):
    pass


class SessionDetailOut(SessionBase):
    records: list[RecordOut]
