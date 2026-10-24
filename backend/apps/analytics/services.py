"""Pure analytics functions: no database access, no Django request objects.

All percentages are returned unrounded (0-100 floats) so threshold comparisons are exact;
presentation code rounds. `None` means "not enough data" (e.g. no classes held yet).
"""

import datetime as dt
import math
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from fractions import Fraction

EXCUSED_EXCLUDE = "EXCLUDE"
EXCUSED_PRESENT = "PRESENT"
EXCUSED_ABSENT = "ABSENT"

LOW_ATTENDANCE = "LOW_ATTENDANCE"
ATTENDANCE_WARNING = "ATTENDANCE_WARNING"
FAILING_SUBJECT = "FAILING_SUBJECT"
SHARP_DROP = "SHARP_DROP"

# Alerts that put a student on a faculty member's "at risk" list.
AT_RISK_CODES = frozenset({LOW_ATTENDANCE, FAILING_SUBJECT, SHARP_DROP})


@dataclass(frozen=True)
class AnalyticsConfig:
    threshold: float = 75.0
    warning_upper: float = 80.0
    late_counts_as_present: bool = True
    excused_policy: str = EXCUSED_EXCLUDE
    pass_mark: float = 40.0
    sharp_drop_points: float = 15.0

    @classmethod
    def from_settings(cls) -> "AnalyticsConfig":
        from django.conf import settings

        policy = str(settings.ATTENDANCE_EXCUSED_POLICY).upper()
        if policy not in {EXCUSED_EXCLUDE, EXCUSED_PRESENT, EXCUSED_ABSENT}:
            raise ValueError(f"Invalid ATTENDANCE_EXCUSED_POLICY: {policy!r}")
        return cls(
            threshold=float(settings.ATTENDANCE_THRESHOLD_PERCENT),
            warning_upper=float(settings.ATTENDANCE_WARNING_UPPER_PERCENT),
            late_counts_as_present=bool(settings.ATTENDANCE_LATE_COUNTS_AS_PRESENT),
            excused_policy=policy,
            pass_mark=float(settings.PASS_MARK_PERCENT),
            sharp_drop_points=float(settings.SHARP_DROP_POINTS),
        )


@dataclass(frozen=True)
class AttendanceCounts:
    present: int = 0
    absent: int = 0
    late: int = 0
    excused: int = 0

    @property
    def total(self) -> int:
        return self.present + self.absent + self.late + self.excused

    def __add__(self, other: "AttendanceCounts") -> "AttendanceCounts":
        return AttendanceCounts(
            self.present + other.present,
            self.absent + other.absent,
            self.late + other.late,
            self.excused + other.excused,
        )

    @classmethod
    def from_status_counts(cls, status_counts: dict[str, int]) -> "AttendanceCounts":
        return cls(
            present=status_counts.get("PRESENT", 0),
            absent=status_counts.get("ABSENT", 0),
            late=status_counts.get("LATE", 0),
            excused=status_counts.get("EXCUSED", 0),
        )


@dataclass(frozen=True)
class MarkEntry:
    """One student's result in one graded item (an assessment, later also an assignment)."""

    item_id: int
    date: dt.date
    max_marks: float
    marks_obtained: float | None = None
    is_absent: bool = False
    #: "assessment" or "assignment": item ids are only unique within one kind.
    kind: str = "assessment"

    @property
    def is_graded(self) -> bool:
        """Absent counts as graded (a zero); an empty mark means "not entered yet"."""
        return self.is_absent or self.marks_obtained is not None

    @property
    def percent(self) -> float | None:
        if not self.is_graded or self.max_marks <= 0:
            return None
        return 0.0 if self.is_absent else float(self.marks_obtained) / float(self.max_marks) * 100


@dataclass(frozen=True)
class Alert:
    code: str
    severity: str  # "critical" | "warning"
    message: str


# ---------------------------------------------------------------- generic helpers


def class_average(values: Iterable[float | None]) -> float | None:
    """Mean of the values that exist (None ignored); None when there are none."""
    present = [v for v in values if v is not None]
    return sum(present) / len(present) if present else None


def diff_points(value: float | None, average: float | None) -> float | None:
    """How many percentage points `value` is above (+) or below (-) `average`; None if either is missing."""
    if value is None or average is None:
        return None
    return value - average


# ---------------------------------------------------------------- attendance


def effective_attendance(counts: AttendanceCounts, cfg: AnalyticsConfig) -> tuple[int, int]:
    """Return (attended, counted) after applying the LATE / EXCUSED policies."""
    attended = counts.present
    counted = counts.present + counts.absent + counts.late
    if cfg.late_counts_as_present:
        attended += counts.late
    if cfg.excused_policy == EXCUSED_PRESENT:
        attended += counts.excused
        counted += counts.excused
    elif cfg.excused_policy == EXCUSED_ABSENT:
        counted += counts.excused
    return attended, counted


def attendance_percentage(counts: AttendanceCounts, cfg: AnalyticsConfig) -> float | None:
    attended, counted = effective_attendance(counts, cfg)
    if counted == 0:
        return None
    return attended / counted * 100


def classes_needed_to_reach(
    counts: AttendanceCounts, cfg: AnalyticsConfig, threshold: float | None = None
) -> int | None:
    """Fewest consecutive future classes that must be attended to reach the threshold.

    0 when already at/above it (or no classes counted yet); None when it is unreachable
    (threshold of 100% or more after any miss).
    """
    attended, counted = effective_attendance(counts, cfg)
    target = Fraction(str(cfg.threshold if threshold is None else threshold)) / 100
    if counted == 0 or Fraction(attended, counted) >= target:
        return 0
    if target >= 1:
        return None
    # (attended + n) / (counted + n) >= target  =>  n >= (target*counted - attended) / (1 - target)
    return math.ceil((target * counted - attended) / (1 - target))


def monthly_trend(rows: Iterable[tuple[str, str, int]], cfg: AnalyticsConfig) -> list[dict]:
    """rows are (month "YYYY-MM", status, count). Returns chronological monthly percentages."""
    by_month: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for month, status, count in rows:
        by_month[month][status] += count
    trend = []
    for month in sorted(by_month):
        counts = AttendanceCounts.from_status_counts(by_month[month])
        trend.append(
            {"month": month, "attendance_pct": attendance_percentage(counts, cfg), "classes": counts.total}
        )
    return trend


# ---------------------------------------------------------------- marks


def average_score(entries: Sequence[MarkEntry]) -> float | None:
    """Mean of (marks / max * 100) over the graded items; every item counts equally.

    Items not graded yet are ignored. An item the student was absent for counts as 0.
    None when nothing is graded.
    """
    return class_average(e.percent for e in entries)


def detect_sharp_drop(entries: Sequence[MarkEntry], cfg: AnalyticsConfig) -> tuple[float, float] | None:
    """(previous %, latest %) when the latest score fell by more than the configured points.

    Compares the two most recent items where the student actually sat the paper
    (absences are not comparable), ordered by date then id.
    """
    sat = sorted(
        (e for e in entries if not e.is_absent and e.percent is not None),
        key=lambda e: (e.date, e.kind, e.item_id),
    )
    if len(sat) < 2:
        return None
    previous, latest = sat[-2].percent, sat[-1].percent
    if previous - latest > cfg.sharp_drop_points:
        return previous, latest
    return None


def histogram(values: Iterable[float | None], bucket_size: int = 10, upper: int = 100) -> list[dict]:
    """Fixed-width buckets over [0, upper]; the last bucket includes `upper`. Ignores None."""
    edges = list(range(0, upper, bucket_size))
    counts = [0] * len(edges)
    for value in values:
        if value is None:
            continue
        index = min(max(int(value // bucket_size), 0), len(edges) - 1)
        counts[index] += 1
    return [
        {
            "label": f"{lo}-{min(lo + bucket_size, upper)}",
            "min": lo,
            "max": min(lo + bucket_size, upper),
            "count": n,
        }
        for lo, n in zip(edges, counts, strict=True)
    ]


# ---------------------------------------------------------------- alerts


def build_alerts(
    attendance_pct: float | None,
    score: float | None,
    entries: Sequence[MarkEntry],
    cfg: AnalyticsConfig,
) -> list[Alert]:
    alerts: list[Alert] = []
    if attendance_pct is not None:
        if attendance_pct < cfg.threshold:
            alerts.append(
                Alert(
                    LOW_ATTENDANCE,
                    "critical",
                    f"Attendance {attendance_pct:.1f}% is below {cfg.threshold:g}%",
                )
            )
        elif attendance_pct < cfg.warning_upper:
            alerts.append(
                Alert(
                    ATTENDANCE_WARNING,
                    "warning",
                    f"Attendance {attendance_pct:.1f}% is close to the {cfg.threshold:g}% minimum",
                )
            )
    if score is not None and score < cfg.pass_mark:
        alerts.append(
            Alert(
                FAILING_SUBJECT,
                "critical",
                f"Average score {score:.1f}% is below the pass mark of {cfg.pass_mark:g}%",
            )
        )
    drop = detect_sharp_drop(entries, cfg)
    if drop is not None:
        alerts.append(
            Alert(SHARP_DROP, "warning", f"Latest score fell from {drop[0]:.1f}% to {drop[1]:.1f}%")
        )
    return alerts


def is_at_risk(alerts: Iterable[Alert]) -> bool:
    return any(a.code in AT_RISK_CODES for a in alerts)


@dataclass
class SubjectMetrics:
    """Everything derived for one student in one subject (or class)."""

    counts: AttendanceCounts
    attendance_pct: float | None
    classes_needed: int | None
    average_score: float | None
    alerts: list[Alert] = field(default_factory=list)


def subject_metrics(
    counts: AttendanceCounts, entries: Sequence[MarkEntry], cfg: AnalyticsConfig
) -> SubjectMetrics:
    pct = attendance_percentage(counts, cfg)
    score = average_score(entries)
    return SubjectMetrics(
        counts=counts,
        attendance_pct=pct,
        classes_needed=classes_needed_to_reach(counts, cfg),
        average_score=score,
        alerts=build_alerts(pct, score, entries, cfg),
    )
