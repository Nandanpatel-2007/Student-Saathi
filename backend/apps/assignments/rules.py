"""Pure assignment rules: submission timing, per-student status and human wording. No database."""

import datetime as dt
import math

ON_TIME = "ON_TIME"
LATE = "LATE"

NOT_SUBMITTED = "NOT_SUBMITTED"
SUBMITTED = "SUBMITTED"
GRADED = "GRADED"
OVERDUE_MISSING = "OVERDUE_MISSING"
# LATE doubles as a status: submitted after the deadline and not graded yet.

STATUSES = (NOT_SUBMITTED, SUBMITTED, LATE, GRADED, OVERDUE_MISSING)


def timing(submitted_at: dt.datetime, due_at: dt.datetime) -> str:
    """ON_TIME up to and including the deadline instant, LATE after it."""
    return ON_TIME if submitted_at <= due_at else LATE


def offset_seconds(submitted_at: dt.datetime, due_at: dt.datetime) -> int:
    """Seconds from the deadline to the submission: negative = before, positive = after.

    Rounded away from zero so a submission even a fraction of a second late never reads as 0.
    """
    seconds = (submitted_at - due_at).total_seconds()
    return math.ceil(seconds) if seconds > 0 else math.floor(seconds)


def derive_status(*, submitted: bool, graded: bool, late: bool, now: dt.datetime, due_at: dt.datetime) -> str:
    """One student's status for one assignment."""
    if not submitted:
        return OVERDUE_MISSING if now > due_at else NOT_SUBMITTED
    if graded:
        return GRADED
    return LATE if late else SUBMITTED


def _plural(count: int, unit: str) -> str:
    return f"{count} {unit}{'' if count == 1 else 's'}"


def timing_text(offset: int) -> str:
    """Human wording using the largest sensible units.

    Early work names its largest unit ("2 days before the deadline"); late work names up to two
    ("3 days 4 hours late"). The frontend's lib/timing.ts follows the same rules.
    """
    if offset == 0:
        return "On the deadline"
    seconds = abs(offset)
    days, rest = divmod(seconds, 86400)
    hours, rest = divmod(rest, 3600)
    minutes = rest // 60

    if offset < 0:
        if days:
            amount = _plural(days, "day")
        elif hours:
            amount = _plural(hours, "hour")
        elif minutes:
            amount = _plural(minutes, "minute")
        else:
            amount = "less than a minute"
        return f"{amount} before the deadline"

    if days:
        parts = [_plural(days, "day")] + ([_plural(hours, "hour")] if hours else [])
    elif hours:
        parts = [_plural(hours, "hour")] + ([_plural(minutes, "minute")] if minutes else [])
    elif minutes:
        parts = [_plural(minutes, "minute")]
    else:
        parts = ["less than a minute"]
    return f"{' '.join(parts)} late"
