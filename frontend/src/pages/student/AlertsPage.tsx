import { PageTitle } from '../../components/faculty/PageTitle'
import { AlertList } from '../../components/student/AlertList'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/States'
import { useStudentContext } from '../../hooks/useStudentContext'
import { sortAlerts } from '../../lib/student-derive'

export function AlertsPage() {
  const { data } = useStudentContext()
  const sorted = sortAlerts(data.alerts)
  const critical = sorted.filter((a) => a.severity === 'critical')
  const warnings = sorted.filter((a) => a.severity === 'warning')

  return (
    <div className="space-y-6">
      <PageTitle title="Alerts" subtitle="Worked out from your latest attendance and marks each time you open the portal." />

      {sorted.length === 0 ? (
        <Card>
          <EmptyState title="No alerts" body="Your attendance and scores look fine right now. Check back after new classes or results." />
        </Card>
      ) : (
        <>
          {critical.length > 0 && (
            <Card className="border-danger-line">
              <CardHeader as="h2" title="Critical" subtitle={`${critical.length} need${critical.length === 1 ? 's' : ''} action`} />
              <AlertList alerts={critical} />
            </Card>
          )}
          {warnings.length > 0 && (
            <Card>
              <CardHeader as="h2" title="Warnings" subtitle="Worth keeping an eye on" />
              <AlertList alerts={warnings} />
            </Card>
          )}
        </>
      )}
    </div>
  )
}
