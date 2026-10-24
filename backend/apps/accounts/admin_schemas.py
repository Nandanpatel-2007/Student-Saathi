from ninja import Field, Schema

from apps.academics.schemas import SectionOut


class OverviewOut(Schema):
    students: int
    faculty: int
    subjects: int
    sections: int
    teaching_assignments: int
    enrollments: int


class DepartmentOut(Schema):
    id: int
    name: str
    code: str


class FacultyLookupOut(Schema):
    id: int = Field(..., description="FacultyProfile id (use it as faculty_id)")
    employee_id: str
    name: str
    department: DepartmentOut

    @staticmethod
    def resolve_name(obj):
        return obj.user.display_name


class StudentLookupOut(Schema):
    id: int = Field(..., description="StudentProfile id (use it as student_id)")
    roll_no: str
    name: str
    admission_year: int
    section: SectionOut

    @staticmethod
    def resolve_name(obj):
        return obj.user.display_name
