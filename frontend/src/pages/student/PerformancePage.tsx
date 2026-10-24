import { Award, GraduationCap, TrendingDown, TriangleAlert } from 'lucide-react'

import { DataTable, type Column } from '../../components/faculty/DataTable'
import { PageTitle } from '../../components/faculty/PageTitle'
import { StatCard } from '../../components/faculty/StatCard'
import { AlertChips } from '../../components/faculty/StatusBadge'
import { AlertList } from '../../components/student/AlertList'
import { ScoreBars } from '../../components/student/ScoreBars'
import { Card, CardHeader } from '../../components/ui/Card'
import { DiffIndicator } from '../../components/ui/DiffIndicator'
import { EmptyState } from '../../components/ui/States'
import { useStudentContext } from '../../hooks/useStudentContext'
import { compare } from '../../lib/compare'
import { formatPercent } from '../../lib/format'
import type { SubjectStats } from '../../lib/student-api'
import { SCORE_ALERT_CODES, computeTotals } from '../../lib/student-derive'

export function PerformancePage() {
  const { data } = useStudentContext()
  const totals = computeTotals(data.subjects)
  const scoreAlerts = data.alerts.filter((a) => SCORE_ALERT_CODES.includes(a.code))
  const anyGraded = data.average_score_overall !== null

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
    {
      key: 'score',
      header: 'Your average',
      align: 'right',
      cell: (s) =>
        s.average_score_pct === null ? (
          <span className="text-muted">No data yet</span>
        ) : (
          <span className="font-medium tabular-nums">{formatPercent(s.average_score_pct)}</span>
        ),
    },
    {
      key: 'avg',
      header: 'Class avg',
      align: 'right',
      cell: (s) =>
        s.class_avg_score_pct === null ? (
          <span className="text-muted">No data yet</span>
        ) : (
          <span className="tabular-nums">{formatPercent(s.class_avg_score_pct)}</span>
        ),
    },
    {
      key: 'diff',
      header: 'You vs class',
      cell: (s) => <DiffIndicator comparison={compare(s.average_score_pct, s.class_avg_score_pct)} />,
    },
    {
      key: 'alerts',
      header: 'Alerts',
      cell: (s) => <AlertChips alerts={s.alerts.filter((a) => SCORE_ALERT_CODES.includes(a.code))} />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageTitle title="Performance" subtitle="Your average marks in each subject compared with the class average." />

      {scoreAlerts.length > 0 && (
        <Card className="border-danger-line">
          <CardHeader title="Needs your attention" subtitle="Score alerts from your recent results" />
          <AlertList alerts={scoreAlerts} />
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Average marks"
          value={data.average_score_overall === null ? 'No data yet' : formatPercent(data.average_score_overall)}
          caption={anyGraded ? 'Mean of your subject averages' : 'Nothing graded yet'}
          icon={GraduationCap}
        />
        <StatCard
          title="Best subject"
          value={totals.best ? formatPercent(totals.best.average_score_pct) : 'No data yet'}
          caption={totals.best ? totals.best.subject.name : 'Nothing graded yet'}
          icon={Award}
        />
        <StatCard
          title="Below class average"
          value={String(totals.belowClassScore)}
          caption="Subjects, marks"
          icon={TrendingDown}
        />
        <StatCard
          title="Score alerts"
          value={String(totals.subjectsWithScoreAlert)}
          caption="Subjects with a failing or dropping score"
          icon={TriangleAlert}
        />
      </div>

      <Card>
        <CardHeader title="Marks by subject" subtitle="You and the class average" />
        {anyGraded ? (
          <ScoreBars subjects={data.subjects} />
        ) : (
          <EmptyState title="No marks yet" body="Charts appear once your faculty publish marks." />
        )}
      </Card>

      <Card>
        <CardHeader
          title="Details"
          subtitle="The class average is a single combined figure; other students' marks are never shown."
        />
        <DataTable caption="Performance by subject" columns={columns} rows={data.subjects} rowKey={(s) => s.subject.id} />
      </Card>
    </div>
  )
}
