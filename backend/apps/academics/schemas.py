from ninja import Field, Schema


class SubjectIn(Schema):
    code: str = Field(..., max_length=20)
    name: str = Field(..., max_length=150)
    credits: int = Field(..., ge=0, le=30)
    semester: int = Field(..., ge=1, le=20)


class SubjectOut(Schema):
    id: int
    code: str
    name: str
    credits: int
    semester: int


class SectionIn(Schema):
    name: str = Field(..., max_length=50)
    program: str = Field(..., max_length=100)
    semester: int = Field(..., ge=1, le=20)
    academic_year: str = Field(..., max_length=9, description="e.g. 2025-2026")


class SectionOut(Schema):
    id: int
    name: str
    program: str
    semester: int
    academic_year: str


class StudentBrief(Schema):
    id: int
    roll_no: str
    name: str

    @staticmethod
    def resolve_name(obj):
        return obj.user.display_name


class FacultyBrief(Schema):
    id: int
    employee_id: str
    name: str

    @staticmethod
    def resolve_name(obj):
        return obj.user.display_name


class EnrollmentIn(Schema):
    student_id: int = Field(..., description="StudentProfile id")
    subject_id: int


class EnrollmentOut(Schema):
    id: int
    student: StudentBrief
    subject: SubjectOut


class BulkEnrollIn(Schema):
    section_id: int
    subject_id: int


class BulkEnrollOut(Schema):
    section_id: int
    subject_id: int
    enrolled: int = Field(..., description="Newly created enrollments")
    already_enrolled: int


class TeachingAssignmentIn(Schema):
    faculty_id: int = Field(..., description="FacultyProfile id")
    subject_id: int
    section_id: int


class TeachingAssignmentOut(Schema):
    id: int
    faculty: FacultyBrief
    subject: SubjectOut
    section: SectionOut


class FacultyClassOut(Schema):
    assignment_id: int
    subject: SubjectOut
    section: SectionOut

    @staticmethod
    def resolve_assignment_id(obj):
        return obj.id
