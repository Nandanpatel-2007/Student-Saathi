import { AlertTriangle, CalendarCheck, FileText, GraduationCap, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { AtRiskList, type AtRiskItem } from '../../components/faculty/AtRiskList'
import { ClassPicker } from '../../components/faculty/ClassPicker'
import { MarksDistributionChart } from '../../components/faculty/MarksDistributionChart'
import { PageTitle } from '../../components/faculty/PageTitle'
import { SessionsTable } from '../../components/faculty/SessionsTable'
import { StatCard } from '../../components/faculty/StatCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useSelectedClass } from '../../hooks/useSelectedClass'
import { aggregateSummaries } from '../../lib/faculty-aggregate'
import { classLabel, getClassSummary, listClassSessions, listSessions } from '../../lib/faculty-api'
import { errorMessage, formatNumber, formatPercent } from '../../lib/format'

const MAX_AT_RISK_SHOWN = 8

export function DashboardPage() {
  const { classes, selected, value, setClass } = useSelectedClass({ allowAll: true })
  const targets = useMemo(() => (selected ? [selected] : classes), [selected, classes])

  const summaries = useAsyncData(`dashboard:${targets.map((c) => c.assignment_id).join(',')}`, () =>
    Promise.all(targets.map((c) => getClassSummary(c.assignment_id))),
  )
  const sessions = useAsyncData(`dashboard-sessions:${selected?.assignment_id ?? 'all'}`, async () =>
    selected ? (await listClassSessions(selected)).slice(0, 6) : (await listSessions({ pageSize: 6 })).items,
  )

  const totals = useMemo(() => (summaries.data ? aggregateSummaries(summaries.data) : null), [summaries.data])

  const atRisk: AtRiskItem[] = useMemo(() => {
    if (!summaries.data) return []
    return summaries.data
      .flatMap((summary) =>
        summary.at_risk_students.map((entry) => ({
          ...entry,
          classLabel: selected ? undefined : classLabel(summary),
        })),
      )
      .sort((a, b) => b.alerts.length - a.alerts.length)
  }, [summaries.data, selected])

  const statsLoading = summaries.loading
  const scope = selected ? 'this class' : `${classes.length} class${classes.length === 1 ? '' : 'es'}`
  const noGraded = (totals?.distribution.reduce((sum, b) => sum + b.count, 0) ?? 0) === 0

  return (
    <div className="space-y-6">
      <PageTitle
        title="Dashboard"
        subtitle="Attendance and performance across your classes."
        action={
          <ClassPicker classes={classes} value={value} onChange={setClass} allowAll className="w-full sm:w-72" />
        }
      />

      {summaries.error ? (
        <Card>
          <ErrorState message={errorMessage(summaries.error)} onRetry={summaries.reload} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              title="Students"
              value={String(totals?.students ?? 0)}
              caption={selected ? 'Enrolled in this class' : `Enrolments across ${scope}`}
              icon={Users}
              loading={statsLoading}
            />
            <StatCard
              title="Average attendance"
              value={formatPercent(totals?.attendancePct)}
              caption={`Across ${scope}`}
              icon={CalendarCheck}
              loading={statsLoading}
            />
            <StatCard
              title="Average score"
              value={formatPercent(totals?.averageScore)}
              caption="Mean of the students’ average marks"
              icon={GraduationCap}
              loading={statsLoading}
            />
            <StatCard
              title="At-risk students"
              value={String(totals?.atRiskStudents ?? 0)}
              caption="Flagged in at least one class"
              icon={AlertTriangle}
              loading={statsLoading}
            />
            <StatCard
              title="Submissions to grade"
              value={String(totals?.submissionsToGrade ?? 0)}
              caption="Assignments waiting for marks"
              icon={FileText}
              loading={statsLoading}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader
                title="Marks distribution"
                subtitle={`Average marks of graded students${totals ? ` · average ${formatNumber(totals.averageScore)}%` : ''}`}
              />
              {statsLoading ? (
                <LoadingBlock label="Loading chart…" rows={5} />
              ) : noGraded ? (
                <EmptyState title="No graded marks yet" body="The chart appears once marks have been entered." />
              ) : (
                <MarksDistributionChart buckets={totals?.distribution ?? []} />
              )}
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader
                title="At-risk students"
                subtitle={atRisk.length > 0 ? `${atRisk.length} flagged` : 'Students needing follow-up'}
              />
              {statsLoading ? (
                <LoadingBlock label="Loading at-risk students…" rows={4} />
              ) : atRisk.length === 0 ? (
                <EmptyState title="Nobody is flagged" body="No student currently has a low-attendance, failing or score-drop alert." />
              ) : (
                <>
                  <AtRiskList items={atRisk.slice(0, MAX_AT_RISK_SHOWN)} />
                  {atRisk.length > MAX_AT_RISK_SHOWN && (
                    <p className="border-t border-line px-5 py-3 text-sm text-muted">
                      +{atRisk.length - MAX_AT_RISK_SHOWN} more.{' '}
                      <Link to="/faculty/students" className="text-accent-text underline-offset-4 hover:underline">
                        See the Students page
                      </Link>
                    </p>
                  )}
                </>
              )}
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader
          title="Recent attendance sessions"
          subtitle="Latest recorded classes"
          action={
            <Link
              to={selected ? `/faculty/attendance?class=${selected.assignment_id}` : '/faculty/attendance'}
              className="text-sm font-medium text-accent-text underline-offset-4 hover:underline"
            >
              Take attendance
            </Link>
          }
        />
        {sessions.error ? (
          <ErrorState message={errorMessage(sessions.error)} onRetry={sessions.reload} />
        ) : sessions.loading ? (
          <LoadingBlock label="Loading sessions…" rows={3} />
        ) : !sessions.data || sessions.data.length === 0 ? (
          <EmptyState title="No sessions recorded yet" body="Start one from the Attendance page." />
        ) : (
          <SessionsTable sessions={sessions.data} caption="Recent attendance sessions" showClass={!selected} />
        )}
      </Card>
    </div>
  )
}
