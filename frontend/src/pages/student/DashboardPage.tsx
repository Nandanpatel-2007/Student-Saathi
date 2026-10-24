import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { PageTitle } from '../../components/faculty/PageTitle'
import { AlertList } from '../../components/student/AlertList'
import { AttendanceRing } from '../../components/student/AttendanceRing'
import { SubjectCard } from '../../components/student/SubjectCard'
import { TrendChart } from '../../components/student/TrendChart'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/States'
import { useStudentContext } from '../../hooks/useStudentContext'
import { formatPercent } from '../../lib/format'
import { computeTotals, greeting } from '../../lib/student-derive'

const ALERTS_SHOWN = 4

export function DashboardPage() {
  const { data, reload, refreshing } = useStudentContext()
  const { user } = useAuth()
  const totals = computeTotals(data.subjects)
  const criticalCount = data.alerts.filter((a) => a.severity === 'critical').length
  const firstName = user?.name.split(/\s+/)[0]
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <PageTitle
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        subtitle={`${today}. Your attendance and scores across ${data.subjects.length} subject${data.subjects.length === 1 ? '' : 's'}.`}
        action={
          <Button size="sm" onClick={reload} loading={refreshing}>
            {!refreshing && <RefreshCw className="size-4" aria-hidden="true" />}
            Refresh
          </Button>
        }
      />

      {criticalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-line bg-danger-bg px-5 py-4 text-danger-ink">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
            {criticalCount === 1 ? '1 critical alert needs' : `${criticalCount} critical alerts need`} your attention.
          </p>
          <Link to="/student/alerts" className="text-sm font-medium underline underline-offset-4">
            See the details
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Overall attendance" />
          <div className="flex flex-col items-center px-5 py-6 text-center">
            <AttendanceRing percent={data.attendance_overall} label="Attendance" />
            <p className="mt-4 text-sm text-muted">
              {totals.held === 0
                ? 'No classes have been recorded yet.'
                : `${totals.present + totals.late} of ${totals.held} classes attended.`}
            </p>
            <p className="mt-1 text-sm text-muted">
              Average marks:{' '}
              <span className="font-medium text-ink">
                {data.average_score_overall === null ? 'No data yet' : formatPercent(data.average_score_overall)}
              </span>
            </p>
            {totals.subjectsWithAttendanceAlert > 0 && (
              <p className="mt-1 text-sm font-medium text-ink">
                {totals.subjectsWithAttendanceAlert} subject{totals.subjectsWithAttendanceAlert === 1 ? '' : 's'} need
                {totals.subjectsWithAttendanceAlert === 1 ? 's' : ''} attention.
              </p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Attendance trend" subtitle="Monthly attendance across all subjects" />
          {data.trend.length === 0 ? (
            <EmptyState title="No attendance recorded yet" body="The trend appears after your first classes." />
          ) : (
            <TrendChart trend={data.trend} />
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Alerts" subtitle={data.alerts.length > 0 ? `${data.alerts.length} active` : undefined} />
          {data.alerts.length === 0 ? (
            <EmptyState title="No alerts" body="Your attendance and scores look fine right now." />
          ) : (
            <>
              <AlertList alerts={data.alerts} limit={ALERTS_SHOWN} />
              {data.alerts.length > ALERTS_SHOWN && (
                <p className="border-t border-line px-5 py-3 text-sm">
                  <Link to="/student/alerts" className="text-accent-text underline-offset-4 hover:underline">
                    View all {data.alerts.length} alerts
                  </Link>
                </p>
              )}
            </>
          )}
        </Card>

        <section aria-labelledby="subjects-heading" className="lg:col-span-2">
          <h2 id="subjects-heading" className="mb-3 text-lg font-semibold text-ink">
            Your subjects
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.subjects.map((stats) => (
              <li key={stats.subject.id}>
                <SubjectCard stats={stats} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
