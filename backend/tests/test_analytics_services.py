"""Pure-function tests: no database."""

import datetime as dt

import pytest

from apps.analytics import services as svc
from apps.analytics.services import AnalyticsConfig, AttendanceCounts, MarkEntry

CFG = AnalyticsConfig()
D = dt.date


def counts(present=0, absent=0, late=0, excused=0):
    return AttendanceCounts(present=present, absent=absent, late=late, excused=excused)


def entry(i, pct_of_100=None, *, absent=False, weight=10, max_marks=100, day=1):
    return MarkEntry(
        assessment_id=i,
        date=D(2025, 9, day),
        max_marks=max_marks,
        weightage=weight,
        marks_obtained=pct_of_100,
        is_absent=absent,
    )


# ------------------------------------------------------------------ attendance %


def test_zero_sessions_is_none_not_division_error():
    assert svc.attendance_percentage(counts(), CFG) is None


def test_all_excused_is_none_when_excluded():
    assert svc.attendance_percentage(counts(excused=5), CFG) is None


def test_late_counts_as_present_by_default():
    assert svc.attendance_percentage(counts(present=2, late=2, absent=1), CFG) == pytest.approx(80)


def test_late_can_count_as_absent():
    cfg = AnalyticsConfig(late_counts_as_present=False)
    assert svc.attendance_percentage(counts(present=2, late=2, absent=1), cfg) == pytest.approx(40)


def test_excused_excluded_from_denominator():
    # 3 present, 1 absent, 6 excused -> 3/4, not 3/10
    assert svc.attendance_percentage(counts(present=3, absent=1, excused=6), CFG) == pytest.approx(75)


@pytest.mark.parametrize(
    ("policy", "expected"),
    [(svc.EXCUSED_EXCLUDE, 75), (svc.EXCUSED_PRESENT, 90), (svc.EXCUSED_ABSENT, 30)],
)
def test_excused_policy_is_configurable(policy, expected):
    cfg = AnalyticsConfig(excused_policy=policy)
    assert svc.attendance_percentage(counts(present=3, absent=1, excused=6), cfg) == pytest.approx(expected)


def test_everyone_absent_is_zero_not_none():
    assert svc.attendance_percentage(counts(absent=4), CFG) == 0


def test_config_from_settings_rejects_bad_policy(settings):
    settings.ATTENDANCE_EXCUSED_POLICY = "bogus"
    with pytest.raises(ValueError):
        AnalyticsConfig.from_settings()


def test_config_from_settings_reads_overrides(settings):
    settings.ATTENDANCE_THRESHOLD_PERCENT = 60
    settings.ATTENDANCE_EXCUSED_POLICY = "present"
    cfg = AnalyticsConfig.from_settings()
    assert cfg.threshold == 60 and cfg.excused_policy == svc.EXCUSED_PRESENT


# ------------------------------------------------------------------ classes needed


def test_classes_needed_when_below_threshold():
    # 6/10 = 60%. Need n: (6+n)/(10+n) >= .75 -> n >= 6
    assert svc.classes_needed_to_reach(counts(present=6, absent=4), CFG) == 6
    # verify minimality
    assert (6 + 6) / (10 + 6) >= 0.75 > (6 + 5) / (10 + 5)


def test_classes_needed_zero_when_at_or_above_threshold():
    assert svc.classes_needed_to_reach(counts(present=3, absent=1), CFG) == 0  # exactly 75%
    assert svc.classes_needed_to_reach(counts(present=10), CFG) == 0


def test_classes_needed_zero_when_no_classes_yet():
    assert svc.classes_needed_to_reach(counts(), CFG) == 0


def test_classes_needed_respects_custom_threshold_and_policies():
    assert svc.classes_needed_to_reach(counts(present=6, absent=4), CFG, threshold=60) == 0
    # excused ignored: 1 present, 1 absent -> 50%; need n with (1+n)/(2+n) >= .75 -> n >= 2
    assert svc.classes_needed_to_reach(counts(present=1, absent=1, excused=9), CFG) == 2


def test_classes_needed_unreachable_at_100_percent():
    cfg = AnalyticsConfig(threshold=100)
    assert svc.classes_needed_to_reach(counts(present=9, absent=1), cfg) is None
    assert svc.classes_needed_to_reach(counts(present=9), cfg) == 0


def test_classes_needed_has_no_float_rounding_error():
    # 75% of 4 is exactly 3: float math could ask for an extra class.
    assert svc.classes_needed_to_reach(counts(present=2, absent=2), CFG) == 4  # (2+4)/(4+4)=.75


# ------------------------------------------------------------------ trend


def test_monthly_trend_groups_sorts_and_handles_all_excused_month():
    rows = [
        ("2025-10", "PRESENT", 3),
        ("2025-09", "PRESENT", 1),
        ("2025-09", "ABSENT", 1),
        ("2025-09", "LATE", 2),
        ("2025-11", "EXCUSED", 2),
    ]
    trend = svc.monthly_trend(rows, CFG)
    assert [t["month"] for t in trend] == ["2025-09", "2025-10", "2025-11"]
    assert trend[0]["attendance_pct"] == pytest.approx(75) and trend[0]["classes"] == 4
    assert trend[1]["attendance_pct"] == 100
    assert trend[2]["attendance_pct"] is None


def test_monthly_trend_empty():
    assert svc.monthly_trend([], CFG) == []


# ------------------------------------------------------------------ weighted score


def test_weighted_score_basic():
    entries = [entry(1, 80, weight=40), entry(2, 50, weight=60)]
    assert svc.weighted_score(entries) == pytest.approx(62)


def test_weighted_score_scales_by_max_marks():
    assert svc.weighted_score([entry(1, 15, max_marks=20, weight=100)]) == pytest.approx(75)


def test_pending_assessments_do_not_count():
    entries = [entry(1, 80, weight=20), entry(2, None, weight=80)]
    assert svc.weighted_score(entries) == pytest.approx(80)


def test_absent_counts_as_zero_unlike_pending():
    entries = [entry(1, 80, weight=50), entry(2, absent=True, weight=50)]
    assert svc.weighted_score(entries) == pytest.approx(40)


def test_nothing_graded_or_zero_weight_is_none():
    assert svc.weighted_score([]) is None
    assert svc.weighted_score([entry(1, None)]) is None
    assert svc.weighted_score([entry(1, 50, weight=0)]) is None


def test_zero_max_marks_is_ignored_safely():
    assert svc.weighted_score([entry(1, 0, max_marks=0)]) is None


# ------------------------------------------------------------------ standing


def test_class_standing_rank_ties_and_percentile():
    scores = {1: 90.0, 2: 70.0, 3: 70.0, 4: 50.0, 5: None}
    top = svc.class_standing(scores, 1)
    assert (top.rank, top.graded_students) == (1, 4)
    assert top.class_avg == pytest.approx(70)
    assert top.percentile == pytest.approx(87.5)  # 3 below / 4
    tied = svc.class_standing(scores, 2)
    assert tied.rank == 2 and svc.class_standing(scores, 3).rank == 2
    assert tied.percentile == pytest.approx(50)  # (1 below + 1 level) / 4
    assert svc.class_standing(scores, 4).rank == 4


def test_class_standing_ungraded_student_still_sees_average():
    standing = svc.class_standing({1: 60.0, 2: None}, 2)
    assert standing.rank is None and standing.percentile is None and standing.class_avg == 60


def test_class_standing_empty_and_single():
    assert svc.class_standing({}, 1) == svc.Standing(None, None, None, 0)
    assert svc.class_standing({1: 33.0}, 1).percentile == 50


# ------------------------------------------------------------------ histogram


def test_histogram_buckets_edges():
    h = svc.histogram([0, 9.99, 10, 55, 99.9, 100, None])
    assert len(h) == 10
    assert h[0] == {"label": "0-10", "min": 0, "max": 10, "count": 2}
    assert h[1]["count"] == 1 and h[5]["count"] == 1
    assert h[9]["count"] == 2  # 99.9 and 100 share the last bucket
    assert sum(b["count"] for b in h) == 6


def test_histogram_empty_has_all_buckets():
    assert [b["count"] for b in svc.histogram([])] == [0] * 10


# ------------------------------------------------------------------ alerts


def codes(alerts):
    return [a.code for a in alerts]


@pytest.mark.parametrize(
    ("pct", "expected"),
    [
        (None, []),
        (0, [svc.LOW_ATTENDANCE]),
        (74.99, [svc.LOW_ATTENDANCE]),
        (75, [svc.ATTENDANCE_WARNING]),
        (79.99, [svc.ATTENDANCE_WARNING]),
        (80, []),
        (100, []),
    ],
)
def test_attendance_alert_boundaries(pct, expected):
    assert codes(svc.build_alerts(pct, None, [], CFG)) == expected


@pytest.mark.parametrize(
    ("score", "expected"), [(None, []), (39.99, [svc.FAILING_SUBJECT]), (40, []), (0, [svc.FAILING_SUBJECT])]
)
def test_failing_boundaries(score, expected):
    assert codes(svc.build_alerts(100, score, [], CFG)) == expected


def test_failing_threshold_is_configurable():
    assert codes(svc.build_alerts(100, 50, [], AnalyticsConfig(pass_mark=60))) == [svc.FAILING_SUBJECT]


def test_sharp_drop_strictly_greater_than_15():
    assert svc.detect_sharp_drop([entry(1, 80, day=1), entry(2, 65, day=2)], CFG) is None  # exactly 15
    assert svc.detect_sharp_drop([entry(1, 80, day=1), entry(2, 64.9, day=2)], CFG) == (80, 64.9)


def test_sharp_drop_uses_latest_two_in_date_order_not_input_order():
    entries = [entry(3, 40, day=3), entry(1, 90, day=1), entry(2, 45, day=2)]
    assert svc.detect_sharp_drop(entries, CFG) is None  # 45 -> 40
    assert svc.detect_sharp_drop([entry(1, 90, day=1), entry(2, 45, day=2)], CFG) == (90, 45)


def test_sharp_drop_ignores_absences_pending_and_single_assessment():
    assert svc.detect_sharp_drop([entry(1, 90, day=1)], CFG) is None
    assert svc.detect_sharp_drop([entry(1, 90, day=1), entry(2, absent=True, day=2)], CFG) is None
    assert svc.detect_sharp_drop([entry(1, 90, day=1), entry(2, None, day=2)], CFG) is None
    # an absence between two sat papers is skipped over
    assert (
        svc.detect_sharp_drop([entry(1, 90, day=1), entry(2, absent=True, day=2), entry(3, 85, day=3)], CFG)
        is None
    )


def test_improvement_is_not_a_drop():
    assert svc.detect_sharp_drop([entry(1, 30, day=1), entry(2, 90, day=2)], CFG) is None


def test_multiple_alerts_and_at_risk():
    entries = [entry(1, 80, day=1, weight=10), entry(2, 10, day=2, weight=30)]  # weighted 27.5
    alerts = svc.build_alerts(60, svc.weighted_score(entries), entries, CFG)
    assert codes(alerts) == [svc.LOW_ATTENDANCE, svc.FAILING_SUBJECT, svc.SHARP_DROP]
    assert svc.is_at_risk(alerts)
    assert not svc.is_at_risk(svc.build_alerts(77, 90, [], CFG))  # warning alone is not at-risk


def test_subject_metrics_with_no_data_is_all_empty():
    m = svc.subject_metrics(counts(), [], CFG)
    assert m.attendance_pct is None and m.weighted_score is None and m.alerts == []
    assert m.classes_needed == 0
