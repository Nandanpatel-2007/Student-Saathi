import { formatPercent } from '../../lib/format'
import type { SubjectStats } from '../../lib/student-api'
import {
  ATTENDANCE_ALERT_CODES,
  attendanceGap,
  classesNeededText,
  ordinal,
  subjectTone,
} from '../../lib/student-derive'
import { AlertChip } from '../faculty/StatusBadge'
import { Card } from '../ui/Card'
import { PercentBar } from './PercentBar'

/** One subject: attendance, weighted score against the class average, and its alert chips. */
export function SubjectCard({ stats }: { stats: SubjectStats }) {
  const { subject } = stats
  const gap = attendanceGap(stats)
  const needed = classesNeededText(stats.classes_needed_for_threshold)
  const tone = subjectTone(stats.alerts, ATTENDANCE_ALERT_CODES)

  return (
    <Card className="flex h-full flex-col p-5">
      <p className="text-sm font-medium text-accent-text">{subject.code}</p>
      <h3 className="mt-0.5 text-base font-semibold text-ink">{subject.name}</h3>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted">Attendance</span>
          {gap ? (
            <span className="text-sm text-muted">{gap}</span>
          ) : (
            <span className="font-display text-xl font-semibold text-ink tabular-nums">{formatPercent(stats.attendance_pct)}</span>
          )}
        </div>
        <PercentBar value={stats.attendance_pct} tone={tone} className="mt-2" />
        {stats.classes_held > 0 && (
          <p className="mt-1.5 text-xs text-muted tabular-nums">
            {stats.present} present · {stats.absent} absent · {stats.late} late · {stats.excused} excused, of{' '}
            {stats.classes_held}
          </p>
        )}
        {needed && stats.classes_needed_for_threshold !== 0 && <p className="mt-1.5 text-sm text-ink">{needed}</p>}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        {stats.weighted_score === null ? (
          <p className="text-sm text-muted">Not graded yet</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Weighted score</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink tabular-nums">{formatPercent(stats.weighted_score)}</dd>
            </div>
            <div>
              <dt className="text-muted">Class average</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink tabular-nums">{formatPercent(stats.class_avg)}</dd>
            </div>
            {stats.percentile !== null && (
              <div className="col-span-2 text-muted">
                You are at the {ordinal(stats.percentile)} percentile in your class.
              </div>
            )}
          </dl>
        )}
      </div>

      {stats.alerts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {stats.alerts.map((alert) => (
            <AlertChip key={alert.code} alert={alert} />
          ))}
        </div>
      )}
    </Card>
  )
}
