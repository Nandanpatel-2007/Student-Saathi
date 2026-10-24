import { Award, GraduationCap, TrendingDown, TriangleAlert } from 'lucide-react'

import { DataTable, type Column } from '../../components/faculty/DataTable'
import { PageTitle } from '../../components/faculty/PageTitle'
import { StatCard } from '../../components/faculty/StatCard'
import { AlertChips } from '../../components/faculty/StatusBadge'
import { AlertList } from '../../components/student/AlertList'
import { ScoreBars } from '../../components/student/ScoreBars'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/States'
import { useStudentContext } from '../../hooks/useStudentContext'
import { cn } from '../../lib/cn'
import { formatNumber, formatPercent } from '../../lib/format'
import type { SubjectStats } from '../../lib/student-api'
import { SCORE_ALERT_CODES, computeTotals, ordinal } from '../../lib/student-derive'

export function PerformancePage() {
  const { data } = useStudentContext()
  const totals = computeTotals(data.subjects)
  const scoreAlerts = data.alerts.filter((a) => SCORE_ALERT_CODES.includes(a.code))
  const anyGraded = totals.averageScore !== null

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
      header: 'Weighted score',
      align: 'right',
      cell: (s) =>
        s.weighted_score === null ? (
          <span className="text-muted">Not graded yet</span>
        ) : (
          <span className="font-medium tabular-nums">{formatPercent(s.weighted_score)}</span>
        ),
    },
    {
      key: 'avg',
      header: 'Class average',
      align: 'right',
      cell: (s) => <span className="tabular-nums">{formatPercent(s.class_avg)}</span>,
    },
    {
      key: 'diff',
      header: 'Difference',
      align: 'right',
      cell: (s) => {
        if (s.weighted_score === null || s.class_avg === null) return <span className="text-muted">—</span>
        const diff = s.weighted_score - s.class_avg
        return (
          <span className={cn('tabular-nums', diff < 0 ? 'text-danger-ink' : 'text-accent-text')}>
            {diff > 0 ? '+' : ''}
            {formatNumber(diff)} pts
          </span>
        )
      },
    },
    {
      key: 'pct',
      header: 'Your percentile',
      align: 'right',
      cell: (s) =>
        s.percentile === null ? <span className="text-muted">—</span> : <span className="tabular-nums">{ordinal(s.percentile)}</span>,
    },
    {
      key: 'alerts',
      header: 'Alerts',
      cell: (s) => <AlertChips alerts={s.alerts.filter((a) => SCORE_ALERT_CODES.includes(a.code))} />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageTitle title="Performance" subtitle="Your weighted score in each subject compared with the class average." />

      {scoreAlerts.length > 0 && (
        <Card className="border-danger-line">
          <CardHeader title="Needs your attention" subtitle="Score alerts from your recent results" />
          <AlertList alerts={scoreAlerts} />
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Average weighted score"
          value={formatPercent(totals.averageScore)}
          caption={anyGraded ? 'Across graded subjects' : 'Nothing graded yet'}
          icon={GraduationCap}
        />
        <StatCard
          title="Best subject"
          value={totals.best ? formatPercent(totals.best.weighted_score) : '—'}
          caption={totals.best ? totals.best.subject.name : 'Nothing graded yet'}
          icon={Award}
        />
        <StatCard
          title="Below class average"
          value={String(totals.belowClassAverage)}
          caption="Graded subjects"
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
        <CardHeader title="Score by subject" subtitle="Weighted score and class average" />
        {anyGraded ? (
          <ScoreBars subjects={data.subjects} />
        ) : (
          <EmptyState title="No marks yet" body="Charts appear once your faculty publish marks." />
        )}
      </Card>

      <Card>
        <CardHeader title="Details" subtitle="Percentile is your own position in the class; other students' marks are never shown." />
        <DataTable caption="Performance by subject" columns={columns} rows={data.subjects} rowKey={(s) => s.subject.id} />
      </Card>
    </div>
  )
}
