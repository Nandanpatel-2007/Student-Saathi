from ninja import Field, Schema

from apps.academics.schemas import SectionOut, StudentBrief, SubjectOut


class AlertOut(Schema):
    code: str = Field(..., description="LOW_ATTENDANCE | ATTENDANCE_WARNING | FAILING_SUBJECT | SHARP_DROP")
    severity: str = Field(..., description="critical | warning")
    message: str
    subject_id: int | None = None
    subject_code: str | None = None


class DashboardSubject(Schema):
    subject: SubjectOut
    present: int
    absent: int
    late: int
    excused: int
    classes_held: int
    attendance_pct: float | None = None
    classes_needed_for_threshold: int | None = Field(
        None, description="Consecutive classes to attend to reach the threshold; 0 if already there"
    )
    weighted_score: float | None = None
    class_avg: float | None = None
    percentile: float | None = Field(None, description="This student's percentile in the class")
    alerts: list[AlertOut]


class TrendPoint(Schema):
    month: str = Field(..., description="YYYY-MM")
    attendance_pct: float | None = None
    classes: int


class StudentDashboardOut(Schema):
    attendance_overall: float | None = None
    subjects: list[DashboardSubject]
    alerts: list[AlertOut]
    trend: list[TrendPoint]


class HistogramBucket(Schema):
    label: str
    min: int
    max: int
    count: int


class AtRiskStudent(Schema):
    student: StudentBrief
    attendance_pct: float | None = None
    weighted_score: float | None = None
    alerts: list[AlertOut]


class ClassSummaryOut(Schema):
    assignment_id: int
    subject: SubjectOut
    section: SectionOut
    students: int
    sessions_held: int
    attendance_pct: float | None = None
    average_score: float | None = None
    marks_distribution: list[HistogramBucket]
    at_risk_students: list[AtRiskStudent]


class ClassStudentOut(Schema):
    student: StudentBrief
    present: int
    absent: int
    late: int
    excused: int
    attendance_pct: float | None = None
    classes_needed_for_threshold: int | None = None
    weighted_score: float | None = None
    rank: int | None = None
    percentile: float | None = None
    alerts: list[AlertOut]
