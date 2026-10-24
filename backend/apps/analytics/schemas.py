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
    class_avg_attendance_pct: float | None = Field(
        None, description="Mean of the class's students' attendance percentages"
    )
    classes_needed_for_threshold: int | None = Field(
        None, description="Consecutive classes to attend to reach the threshold; 0 if already there"
    )
    average_score_pct: float | None = Field(
        None, description="Mean of the student's marks percentages over graded items"
    )
    class_avg_score_pct: float | None = Field(
        None, description="Mean of the class's students' average score percentages"
    )
    alerts: list[AlertOut]


class TrendPoint(Schema):
    month: str = Field(..., description="YYYY-MM")
    attendance_pct: float | None = None
    classes: int


class StudentDashboardOut(Schema):
    attendance_overall: float | None = None
    average_score_overall: float | None = Field(None, description="Mean of the subject averages that exist")
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
    average_score_pct: float | None = None
    alerts: list[AlertOut]


class ClassSummaryOut(Schema):
    assignment_id: int
    subject: SubjectOut
    section: SectionOut
    students: int
    sessions_held: int
    attendance_pct: float | None = Field(None, description="Class average of the students' attendance %")
    average_score_pct: float | None = Field(
        None, description="Class average of the students' average score %"
    )
    marks_distribution: list[HistogramBucket]
    at_risk_students: list[AtRiskStudent]


class ClassStudentOut(Schema):
    student: StudentBrief
    present: int
    absent: int
    late: int
    excused: int
    attendance_pct: float | None = None
    average_score_pct: float | None = None
    diff_from_class_attendance: float | None = Field(
        None, description="Percentage points above (+) or below (-) the class average"
    )
    diff_from_class_score: float | None = Field(
        None, description="Percentage points above (+) or below (-) the class average"
    )
    classes_needed_for_threshold: int | None = None
    alerts: list[AlertOut]
