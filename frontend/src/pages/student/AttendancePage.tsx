import { BookOpenCheck, CalendarDays, CircleX, TriangleAlert } from 'lucide-react'

import { DataTable, type Column } from '../../components/faculty/DataTable'
import { PageTitle } from '../../components/faculty/PageTitle'
import { AlertChips } from '../../components/faculty/StatusBadge'
import { StatCard } from '../../components/faculty/StatCard'
import { PercentBar } from '../../components/student/PercentBar'
import { Card, CardHeader } from '../../components/ui/Card'
import { useStudentContext } from '../../hooks/useStudentContext'
import { formatPercent } from '../../lib/format'
import type { SubjectStats } from '../../lib/student-api'
import {
  ATTENDANCE_ALERT_CODES,
  attendanceGap,
  classesNeededText,
  computeTotals,
  subjectTone,
} from '../../lib/student-derive'

export function AttendancePage() {
  const { data } = useStudentContext()
  const totals = computeTotals(data.subjects)

  const columns: Column<SubjectStats>[] = [
    {
      key: 'subject',
      header: 'Subject',
      cell: (s) => (
        <>
          <span className="font-medium">{s.subject.code}</span>
          <span className="block text-xs text-muted">{s.subject.name}</span>
        </>
      ),
    },
    { key: 'present', header: 'Present', align: 'right', cell: (s) => <span className="tabular-nums">{s.present}</span> },
    { key: 'absent', header: 'Absent', align: 'right', cell: (s) => <span className="tabular-nums">{s.absent}</span> },
    { key: 'late', header: 'Late', align: 'right', cell: (s) => <span className="tabular-nums">{s.late}</span> },
    { key: 'excused', header: 'Excused', align: 'right', cell: (s) => <span className="tabular-nums">{s.excused}</span> },
    { key: 'held', header: 'Held', align: 'right', cell: (s) => <span className="tabular-nums">{s.classes_held}</span> },
    {
      key: 'pct',
      header: 'Attendance',
      cell: (s) => {
        const gap = attendanceGap(s)
        return gap ? (
          <span className="text-muted">{gap}</span>
        ) : (
          <div className="flex min-w-36 items-center gap-3">
            <PercentBar value={s.attendance_pct} tone={subjectTone(s.alerts, ATTENDANCE_ALERT_CODES)} />
            <span className="w-14 shrink-0 text-right font-medium tabular-nums">{formatPercent(s.attendance_pct)}</span>
          </div>
        )
      },
    },
    {
      key: 'needed',
      header: 'Classes needed',
      align: 'right',
      cell: (s) =>
        s.classes_needed_for_threshold === null ? (
          <span className="text-muted">—</span>
        ) : s.classes_needed_for_threshold === 0 ? (
          <span className="text-muted">None</span>
        ) : (
          <span className="font-medium tabular-nums">{s.classes_needed_for_threshold}</span>
        ),
    },
    { key: 'alerts', header: 'Alerts', cell: (s) => <AlertChips alerts={s.alerts.filter((a) => ATTENDANCE_ALERT_CODES.includes(a.code))} /> },
  ]

  const guidance = data.subjects.filter((s) => (s.classes_needed_for_threshold ?? 0) > 0)

  return (
    <div className="space-y-6">
      <PageTitle title="My attendance" subtitle="Present, absent, late and excused classes for every subject." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Overall attendance"
          value={formatPercent(data.attendance_overall)}
          caption={totals.held === 0 ? 'No classes yet' : 'Across all subjects'}
          icon={CalendarDays}
        />
        <StatCard title="Classes held" value={String(totals.held)} caption="Recorded so far" icon={BookOpenCheck} />
        <StatCard title="Classes missed" value={String(totals.absent)} caption="Marked absent" icon={CircleX} />
        <StatCard
          title="Subjects needing attention"
          value={String(totals.subjectsWithAttendanceAlert)}
          caption="Attendance alerts"
          icon={TriangleAlert}
        />
      </div>

      <Card>
        <CardHeader title="Subject attendance" subtitle="Read-only. Your faculty record attendance." />
        <DataTable
          caption="Attendance by subject"
          columns={columns}
          rows={data.subjects}
          rowKey={(s) => s.subject.id}
        />
      </Card>

      {guidance.length > 0 && (
        <Card>
          <CardHeader title="Getting back on track" subtitle="Based on the attendance threshold set by your institution" />
          <ul className="divide-y divide-line">
            {guidance.map((s) => (
              <li key={s.subject.id} className="px-5 py-3 text-sm">
                <span className="font-medium text-ink">{s.subject.code}</span>
                <span className="text-muted"> · {s.subject.name}: </span>
                {classesNeededText(s.classes_needed_for_threshold)}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
