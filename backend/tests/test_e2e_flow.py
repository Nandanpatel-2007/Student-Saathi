"""login -> create session -> mark attendance -> enter marks -> student dashboard, all through the API."""

import datetime as dt

from django.utils import timezone

from apps.academics.models import Enrollment, Subject, TeachingAssignment
from apps.accounts.models import StudentProfile, User

from .conftest import PASSWORD, call, login


def test_end_to_end_flow(client, admin_user, faculty_user, student_user, section):
    # --- admin sets up the class through the API
    subject = call(
        client,
        "post",
        "/subjects",
        "admin1",
        {"code": "CS301", "name": "Algorithms", "credits": 4, "semester": 3},
    ).json()
    buddy_user = User.objects.create_user("stu2", password=PASSWORD, first_name="Buddy")
    buddy = StudentProfile.objects.create(
        user=buddy_user, roll_no="R002", section=section, admission_year=2024
    )
    me = student_user.student_profile
    bulk = call(
        client, "post", "/enrollments/bulk", "admin1", {"section_id": section.id, "subject_id": subject["id"]}
    )
    assert bulk.json()["enrolled"] == 2
    assignment = call(
        client,
        "post",
        "/teaching-assignments",
        "admin1",
        {
            "faculty_id": faculty_user.faculty_profile.id,
            "subject_id": subject["id"],
            "section_id": section.id,
        },
    ).json()

    # --- faculty logs in and finds the class
    assert login(client, "fac1").status_code == 200
    classes = call(client, "get", "/faculty/me/classes", "fac1").json()["items"]
    assert [c["assignment_id"] for c in classes] == [assignment["id"]]

    # --- creates two sessions (everyone pre-filled PRESENT), marks the student absent in one
    today = str(timezone.localdate())
    yesterday = str(timezone.localdate() - dt.timedelta(days=1))
    s1 = call(
        client,
        "post",
        "/attendance/sessions",
        "fac1",
        {"teaching_assignment_id": assignment["id"], "date": yesterday, "period": 1, "topic": "Sorting"},
    )
    s2 = call(
        client,
        "post",
        "/attendance/sessions",
        "fac1",
        {"teaching_assignment_id": assignment["id"], "date": today, "period": 1},
    )
    assert s1.status_code == s2.status_code == 201 and s1.json()["present"] == 2
    marked = call(
        client,
        "put",
        f"/attendance/sessions/{s2.json()['id']}/records",
        "fac1",
        {"records": [{"student_id": me.id, "status": "ABSENT"}]},
    )
    assert marked.status_code == 200 and marked.json()["absent"] == 1

    # --- creates an assessment and enters marks
    assessment = call(
        client,
        "post",
        "/assessments",
        "fac1",
        {
            "teaching_assignment_id": assignment["id"],
            "title": "Midterm",
            "type": "MIDTERM",
            "max_marks": 50,
            "date": today,
        },
    ).json()
    entered = call(
        client,
        "put",
        f"/assessments/{assessment['id']}/marks",
        "fac1",
        {
            "marks": [
                {"student_id": me.id, "marks_obtained": 20},
                {"student_id": buddy.id, "marks_obtained": 40},
            ]
        },
    )
    assert entered.status_code == 200

    # --- the student logs in and sees the result
    assert login(client, "stu1").json()["user"]["role"] == "STUDENT"
    dash = call(client, "get", "/students/me/dashboard", "stu1")
    assert dash.status_code == 200
    body = dash.json()
    [subj] = body["subjects"]
    assert subj["subject"]["code"] == "CS301"
    assert (subj["present"], subj["absent"], subj["classes_held"]) == (1, 1, 2)
    assert subj["attendance_pct"] == 50 and body["attendance_overall"] == 50
    assert subj["average_score_pct"] == 40 and subj["class_avg_score_pct"] == 60
    assert subj["class_avg_attendance_pct"] == 75  # mean of 50 and 100
    assert subj["classes_needed_for_threshold"] == 2  # (1+n)/(2+n) >= .75 -> n >= 2
    assert {a["code"] for a in body["alerts"]} == {"LOW_ATTENDANCE"}  # 40% is not below the 40% pass mark
    assert len(body["trend"]) >= 1

    # --- and faculty sees the same student flagged at risk
    summary = call(client, "get", f"/faculty/classes/{assignment['id']}/summary", "fac1").json()
    assert [r["student"]["roll_no"] for r in summary["at_risk_students"]] == ["R001"]

    # sanity: nothing leaked into unrelated rows
    assert Enrollment.objects.count() == 2 and TeachingAssignment.objects.count() == 1
    assert Subject.objects.count() == 1
