"""Pure-function tests: no database."""

import datetime as dt

import pytest

from apps.analytics import services as svc
from apps.analytics.services import AnalyticsConfig, AttendanceCounts, MarkEntry

CFG = AnalyticsConfig()
D = dt.date


def counts(present=0, absent=0, late=0, excused=0):
    return AttendanceCounts(present=present, absent=absent, late=late, excused=excused)


def entry(i, pct_of_100=None, *, absent=False, max_marks=100, day=1):
    return MarkEntry(
        item_id=i,
        date=D(2025, 9, day),
        max_marks=max_marks,
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


# ------------------------------------------------------------------ average score


def test_average_score_is_the_plain_mean_of_item_percentages():
    # every graded item counts equally, whatever its max marks
    entries = [entry(1, 15, max_marks=20), entry(2, 50, max_marks=100), entry(3, 9, max_marks=10)]
    assert svc.average_score(entries) == pytest.approx((75 + 50 + 90) / 3)


def test_ungraded_items_are_ignored_not_counted_as_zero():
    assert svc.average_score([entry(1, 80), entry(2, None)]) == pytest.approx(80)


def test_absent_counts_as_zero():
    assert svc.average_score([entry(1, 80), entry(2, absent=True)]) == pytest.approx(40)


def test_nothing_graded_is_none():
    assert svc.average_score([]) is None
    assert svc.average_score([entry(1, None), entry(2, None)]) is None


def test_zero_marks_is_a_real_score_but_zero_max_is_ignored():
    assert svc.average_score([entry(1, 0)]) == 0
    assert svc.average_score([entry(1, 0, max_marks=0)]) is None
    assert svc.average_score([entry(1, 5, max_marks=0), entry(2, 50)]) == pytest.approx(50)


def test_only_absences_gives_zero_not_none():
    assert svc.average_score([entry(1, absent=True)]) == 0


# ------------------------------------------------------------------ class average and differences


def test_class_average_ignores_nulls():
    assert svc.class_average([80, None, 60]) == pytest.approx(70)
    assert svc.class_average([None, None]) is None
    assert svc.class_average([]) is None
    assert svc.class_average(x for x in [10.0, 20.0]) == pytest.approx(15)


def test_class_with_a_single_student_averages_to_that_student():
    assert svc.class_average([62.5]) == 62.5
    assert svc.diff_points(62.5, svc.class_average([62.5])) == 0


def test_diff_points_sign_and_nulls():
    assert svc.diff_points(80, 70) == pytest.approx(10)
    assert svc.diff_points(60, 70) == pytest.approx(-10)
    assert svc.diff_points(None, 70) is None
    assert svc.diff_points(70, None) is None
    assert svc.diff_points(None, None) is None


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
    ("score", "expected"),
    [(None, []), (39.99, [svc.FAILING_SUBJECT]), (40, []), (0, [svc.FAILING_SUBJECT])],
)
def test_failing_boundaries(score, expected):
    assert codes(svc.build_alerts(100, score, [], CFG)) == expected


def test_failing_threshold_is_configurable():
    assert codes(svc.build_alerts(100, 50, [], AnalyticsConfig(pass_mark=60))) == [svc.FAILING_SUBJECT]


def test_failing_message_mentions_average_not_weighted():
    [alert] = svc.build_alerts(100, 30, [], CFG)
    assert "Average score" in alert.message and "weighted" not in alert.message.lower()


def test_sharp_drop_strictly_greater_than_15():
    assert svc.detect_sharp_drop([entry(1, 80, day=1), entry(2, 65, day=2)], CFG) is None  # exactly 15
    assert svc.detect_sharp_drop([entry(1, 80, day=1), entry(2, 64.9, day=2)], CFG) == (80, 64.9)


def test_sharp_drop_uses_latest_two_in_date_order_not_input_order():
    entries = [entry(3, 40, day=3), entry(1, 90, day=1), entry(2, 45, day=2)]
    assert svc.detect_sharp_drop(entries, CFG) is None  # 45 -> 40
    assert svc.detect_sharp_drop([entry(1, 90, day=1), entry(2, 45, day=2)], CFG) == (90, 45)


def test_sharp_drop_same_day_ties_break_by_id():
    assert svc.detect_sharp_drop([entry(2, 40, day=1), entry(1, 90, day=1)], CFG) == (90, 40)


def test_sharp_drop_ignores_absences_pending_and_single_item():
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
    entries = [entry(1, 80, day=1), entry(2, 10, day=2)]  # average 45 ... pass mark raised below
    cfg = AnalyticsConfig(pass_mark=50)
    alerts = svc.build_alerts(60, svc.average_score(entries), entries, cfg)
    assert codes(alerts) == [svc.LOW_ATTENDANCE, svc.FAILING_SUBJECT, svc.SHARP_DROP]
    assert svc.is_at_risk(alerts)
    assert not svc.is_at_risk(svc.build_alerts(77, 90, [], CFG))  # warning alone is not at-risk


def test_subject_metrics_with_no_data_is_all_empty():
    m = svc.subject_metrics(counts(), [], CFG)
    assert m.attendance_pct is None and m.average_score is None and m.alerts == []
    assert m.classes_needed == 0


def test_subject_metrics_ties_attendance_and_average_together():
    entries = [entry(1, 60, day=1), entry(2, 50, day=2)]
    m = svc.subject_metrics(counts(present=3, absent=1), entries, CFG)
    assert m.attendance_pct == pytest.approx(75) and m.average_score == pytest.approx(55)
    assert codes(m.alerts) == [svc.ATTENDANCE_WARNING]
