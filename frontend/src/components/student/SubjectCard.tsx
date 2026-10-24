import type { SubjectStats } from '../../lib/student-api'
import {
  ATTENDANCE_ALERT_CODES,
  SCORE_ALERT_CODES,
  attendanceGap,
  classesNeededText,
  subjectTone,
} from '../../lib/student-derive'
import { AlertChip } from '../faculty/StatusBadge'
import { Card } from '../ui/Card'
import { CompareRow } from './CompareRow'

/** One subject: attendance and marks, each against the class average, plus its alert chips. */
export function SubjectCard({ stats }: { stats: SubjectStats }) {
  const { subject } = stats
  const needed = classesNeededText(stats.classes_needed_for_threshold)

  return (
    <Card className="flex h-full flex-col p-5">
      <p className="text-sm font-medium text-accent-text">{subject.code}</p>
      <h3 className="mt-0.5 text-base font-semibold text-ink">{subject.name}</h3>

      <div className="mt-4 space-y-5">
        <div>
          <CompareRow
            label="Attendance"
            you={stats.attendance_pct}
            classAvg={stats.class_avg_attendance_pct}
            tone={subjectTone(stats.alerts, ATTENDANCE_ALERT_CODES)}
            emptyNote={attendanceGap(stats) ?? undefined}
          />
          {stats.classes_held > 0 && (
            <p className="mt-1.5 text-xs text-muted tabular-nums">
              {stats.present} present · {stats.absent} absent · {stats.late} late · {stats.excused} excused, of{' '}
              {stats.classes_held}
            </p>
          )}
          {needed && stats.classes_needed_for_threshold !== 0 && <p className="mt-1.5 text-sm text-ink">{needed}</p>}
        </div>

        <CompareRow
          label="Marks"
          you={stats.average_score_pct}
          classAvg={stats.class_avg_score_pct}
          tone={subjectTone(stats.alerts, SCORE_ALERT_CODES)}
          emptyNote="Nothing graded yet"
        />
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
