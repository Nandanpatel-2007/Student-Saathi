import type { Alert } from './schemas'
import type { SubjectStats } from './student-api'

/** Pure helpers that turn the dashboard payload into display values. No invented numbers. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "2026-09" -> "Sep 2026". Unparseable input is returned unchanged. */
export function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  const name = match ? MONTHS[Number(match[2]) - 1] : undefined
  return match && name ? `${name} ${match[1]}` : month
}

const SEVERITY_ORDER: Record<Alert['severity'], number> = { critical: 0, warning: 1 }

/** Critical first; otherwise keep the server's order, then group by subject. */
export function sortAlerts<T extends Alert>(alerts: readonly T[]): T[] {
  return alerts
    .map((alert, index) => ({ alert, index }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.alert.severity] - SEVERITY_ORDER[b.alert.severity] ||
        (a.alert.subject_code ?? '').localeCompare(b.alert.subject_code ?? '') ||
        a.index - b.index,
    )
    .map(({ alert }) => alert)
}

export type Tone = 'accent' | 'warning' | 'danger'

/** Colour of a subject's bar/ring, taken from the severity of the alerts the API raised for it. */
export function subjectTone(alerts: readonly Alert[], codes?: readonly Alert['code'][]): Tone {
  const relevant = codes ? alerts.filter((a) => codes.includes(a.code)) : alerts
  if (relevant.some((a) => a.severity === 'critical')) return 'danger'
  if (relevant.length > 0) return 'warning'
  return 'accent'
}

export const ATTENDANCE_ALERT_CODES: readonly Alert['code'][] = ['LOW_ATTENDANCE', 'ATTENDANCE_WARNING']
export const SCORE_ALERT_CODES: readonly Alert['code'][] = ['FAILING_SUBJECT', 'SHARP_DROP']

/** Why there is no attendance percentage, if there isn't one. */
export function attendanceGap(subject: SubjectStats): string | null {
  if (subject.attendance_pct !== null) return null
  return subject.classes_held === 0 ? 'No classes yet' : 'All recorded classes were excused'
}

/** "Attend N more classes in a row to reach the threshold" (null when the API gave no figure). */
export function classesNeededText(needed: number | null): string | null {
  if (needed === null) return null
  if (needed === 0) return 'You are at or above the attendance threshold.'
  return `Attend ${needed} more ${needed === 1 ? 'class' : 'classes'} in a row to reach the threshold.`
}

/** 73.3 -> "73rd". */
export function ordinal(value: number): string {
  const n = Math.round(value)
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

export interface StudentTotals {
  held: number
  present: number
  absent: number
  late: number
  excused: number
  /** Mean weighted score over subjects that have one; null if none graded. */
  averageScore: number | null
  best: SubjectStats | null
  /** Graded subjects scoring below their class average. */
  belowClassAverage: number
  subjectsWithAttendanceAlert: number
  subjectsWithScoreAlert: number
}

export function computeTotals(subjects: readonly SubjectStats[]): StudentTotals {
  const graded = subjects.filter((s): s is SubjectStats & { weighted_score: number } => s.weighted_score !== null)
  const best = graded.reduce<SubjectStats | null>(
    (top, s) => (top === null || (top.weighted_score ?? -1) < s.weighted_score ? s : top),
    null,
  )
  const hasAlert = (s: SubjectStats, codes: readonly Alert['code'][]) => s.alerts.some((a) => codes.includes(a.code))
  return {
    held: subjects.reduce((sum, s) => sum + s.classes_held, 0),
    present: subjects.reduce((sum, s) => sum + s.present, 0),
    absent: subjects.reduce((sum, s) => sum + s.absent, 0),
    late: subjects.reduce((sum, s) => sum + s.late, 0),
    excused: subjects.reduce((sum, s) => sum + s.excused, 0),
    averageScore: graded.length ? graded.reduce((sum, s) => sum + s.weighted_score, 0) / graded.length : null,
    best,
    belowClassAverage: graded.filter((s) => s.class_avg !== null && s.weighted_score < s.class_avg).length,
    subjectsWithAttendanceAlert: subjects.filter((s) => hasAlert(s, ATTENDANCE_ALERT_CODES)).length,
    subjectsWithScoreAlert: subjects.filter((s) => hasAlert(s, SCORE_ALERT_CODES)).length,
  }
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
