"""Pure tests: submission timing, status derivation, wording and upload validation. No database."""

import datetime as dt

import pytest

from apps.assignments import rules, uploads
from apps.assignments.uploads import UploadRejected, validate_upload

UTC = dt.UTC
DUE = dt.datetime(2026, 11, 10, 12, 0, tzinfo=UTC)
MB = 1024 * 1024


def at(**delta):
    return DUE + dt.timedelta(**delta)


# ------------------------------------------------------------------ timing and offset


def test_two_days_before_the_deadline():
    assert rules.offset_seconds(at(days=-2), DUE) == -2 * 86400
    assert rules.timing(at(days=-2), DUE) == rules.ON_TIME


def test_three_days_after_the_deadline():
    assert rules.offset_seconds(at(days=3), DUE) == 3 * 86400
    assert rules.timing(at(days=3), DUE) == rules.LATE


def test_exactly_at_the_deadline_is_on_time_with_zero_offset():
    assert rules.offset_seconds(DUE, DUE) == 0
    assert rules.timing(DUE, DUE) == rules.ON_TIME


def test_one_microsecond_late_is_late_and_never_reads_as_zero():
    just_after = at(microseconds=1)
    assert rules.timing(just_after, DUE) == rules.LATE
    assert rules.offset_seconds(just_after, DUE) == 1


def test_offsets_ignore_the_time_zone_of_the_inputs():
    ist = dt.timezone(dt.timedelta(hours=5, minutes=30))
    same_instant_as_due = DUE.astimezone(ist)
    assert rules.offset_seconds(same_instant_as_due, DUE) == 0
    assert rules.timing(same_instant_as_due, DUE) == rules.ON_TIME


# ------------------------------------------------------------------ status


@pytest.mark.parametrize(
    ("submitted", "graded", "late", "now_delta", "expected"),
    [
        (False, False, False, dt.timedelta(days=-1), rules.NOT_SUBMITTED),
        (False, False, False, dt.timedelta(seconds=0), rules.NOT_SUBMITTED),  # on the deadline: still open
        (False, False, False, dt.timedelta(seconds=1), rules.OVERDUE_MISSING),
        (True, False, False, dt.timedelta(days=-1), rules.SUBMITTED),
        (True, False, True, dt.timedelta(days=1), rules.LATE),
        (True, True, False, dt.timedelta(days=1), rules.GRADED),
        (True, True, True, dt.timedelta(days=1), rules.GRADED),  # graded wins; timing stays LATE separately
    ],
)
def test_status_matrix(submitted, graded, late, now_delta, expected):
    status = rules.derive_status(
        submitted=submitted, graded=graded, late=late, now=DUE + now_delta, due_at=DUE
    )
    assert status == expected


# ------------------------------------------------------------------ wording


@pytest.mark.parametrize(
    ("offset", "text"),
    [
        (0, "On the deadline"),
        (-2 * 86400, "2 days before the deadline"),
        (-86400, "1 day before the deadline"),
        (-(2 * 86400 + 5 * 3600), "2 days before the deadline"),  # early work names its largest unit
        (-5 * 3600, "5 hours before the deadline"),
        (-3600, "1 hour before the deadline"),
        (-12 * 60, "12 minutes before the deadline"),
        (-30, "less than a minute before the deadline"),
        (3 * 86400 + 4 * 3600, "3 days 4 hours late"),
        (3 * 86400, "3 days late"),
        (86400 + 59 * 60, "1 day late"),  # minutes are dropped once there are days
        (5 * 3600 + 20 * 60, "5 hours 20 minutes late"),
        (2 * 3600, "2 hours late"),
        (12 * 60, "12 minutes late"),
        (1, "less than a minute late"),
    ],
)
def test_timing_text_uses_the_largest_sensible_units(offset, text):
    assert rules.timing_text(offset) == text


# ------------------------------------------------------------------ uploads: names


def test_sanitize_name_strips_paths_control_characters_and_leading_dots():
    assert uploads.sanitize_name("../../etc/passwd.pdf") == "passwd.pdf"
    assert uploads.sanitize_name("C:\\Users\\me\\essay.docx") == "essay.docx"
    assert uploads.sanitize_name("bad\x00name\n.pdf") == "badname.pdf"
    assert uploads.sanitize_name("  report.pdf  ") == "report.pdf"
    assert uploads.sanitize_name(None) == ""


def test_sanitize_name_caps_length_but_keeps_the_extension():
    long = "a" * 400 + ".pdf"
    clean = uploads.sanitize_name(long)
    assert len(clean) == uploads.MAX_NAME_LENGTH and clean.endswith(".pdf")


# ------------------------------------------------------------------ uploads: validation


def check(name="work.pdf", size=100, content_type="application/pdf", head=b"%PDF-1.4", max_bytes=10 * MB):
    return validate_upload(name=name, size=size, content_type=content_type, head=head, max_bytes=max_bytes)


def test_a_normal_pdf_is_accepted():
    assert check() == ("work.pdf", "pdf")


@pytest.mark.parametrize(
    ("name", "head"),
    [
        ("a.docx", b"PK\x03\x04..."),
        ("a.xlsx", b"PK\x03\x04..."),
        ("a.pptx", b"PK\x05\x06"),
        ("a.zip", b"PK\x03\x04"),
        ("a.doc", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1rest"),
        ("a.ppt", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1rest"),
        ("a.xls", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1rest"),
        ("a.png", b"\x89PNG\r\n\x1a\n.."),
        ("a.JPG", b"\xff\xd8\xff\xe0.."),
        ("a.jpeg", b"\xff\xd8\xff\xdb.."),
        ("notes.txt", "plain text é".encode()),
    ],
)
def test_every_allowed_type_passes_with_matching_contents(name, head):
    clean, ext = check(name=name, head=head, content_type="")
    assert ext == name.rsplit(".", 1)[1].lower() and clean == name


@pytest.mark.parametrize(
    "name", ["virus.exe", "page.html", "script.js", "archive.7z", "noextension", "x.pdf.exe", ".pdf"]
)
def test_other_types_are_rejected(name):
    with pytest.raises(UploadRejected, match="isn’t allowed"):
        check(name=name)


def test_empty_file_is_rejected():
    with pytest.raises(UploadRejected, match="empty"):
        check(size=0, head=b"")


def test_size_limit_is_inclusive_and_message_names_it():
    assert check(size=10 * MB)[1] == "pdf"
    with pytest.raises(UploadRejected, match="10 MB"):
        check(size=10 * MB + 1)


def test_contents_must_match_the_extension():
    with pytest.raises(UploadRejected, match="contents"):
        check(head=b"MZ\x90\x00 an executable")  # an .exe renamed to .pdf
    with pytest.raises(UploadRejected, match="contents"):
        check(name="photo.png", head=b"%PDF-1.4", content_type="image/png")


def test_declared_content_type_must_fit_the_extension():
    with pytest.raises(UploadRejected, match="doesn’t match"):
        check(content_type="text/html")
    assert check(content_type="")[1] == "pdf"
    assert check(content_type="application/octet-stream")[1] == "pdf"


def test_text_files_with_binary_bytes_are_rejected():
    with pytest.raises(UploadRejected, match="plain text"):
        check(name="notes.txt", head=b"hello\x00world", content_type="text/plain")
    assert check(name="notes.txt", head=b"hello", content_type="text/plain; charset=utf-8")[1] == "txt"
