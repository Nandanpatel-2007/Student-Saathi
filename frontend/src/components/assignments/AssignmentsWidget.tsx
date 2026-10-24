import { Link } from 'react-router-dom'

import { useAsyncData } from '../../hooks/useAsyncData'
import { listMyAssignments, type StudentAssignment } from '../../lib/assignments-api'
import { summariseForDashboard } from '../../lib/assignments-derive'
import { formatNumber } from '../../lib/format'
import { relativeDue } from '../../lib/timing'
import { Card, CardHeader } from '../ui/Card'
import { Skeleton } from '../ui/States'

function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section aria-label={title}>
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      {children.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">{children}</ul>
      )}
    </section>
  )
}

function Row({ item, detail }: { item: StudentAssignment; detail: string }) {
  return (
    <li className="text-sm">
      <Link to="/student/assignments" className="font-medium text-ink underline-offset-4 hover:underline">
        {item.title}
      </Link>
      <span className="block text-muted">
        {item.subject.code} · {detail}
      </span>
    </li>
  )
}

/** Light summary on the student dashboard: due soon, overdue, recently graded. Hidden if it cannot load. */
export function AssignmentsWidget() {
  const list = useAsyncData('my-assignments-summary', listMyAssignments)
  if (list.error) return null // the dashboard stays useful without it; the Assignments page shows the error

  const summary = list.data ? summariseForDashboard(list.data) : null
  return (
    <Card>
      <CardHeader
        title="Assignments"
        action={
          <Link to="/student/assignments" className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
            View all
          </Link>
        }
      />
      {!summary ? (
        <div role="status" aria-busy="true" className="grid gap-4 p-5 sm:grid-cols-3">
          <span className="sr-only">Loading assignments…</span>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <div className="grid gap-6 p-5 sm:grid-cols-3">
          <Group title="Due soon" empty="Nothing due.">
            {summary.dueSoon.map((i) => (
              <Row key={i.assignment_id} item={i} detail={relativeDue(i.due_at)} />
            ))}
          </Group>
          <Group title={`Overdue${summary.overdue.length ? ` (${summary.overdue.length})` : ''}`} empty="Nothing missed.">
            {summary.overdue.slice(0, 3).map((i) => (
              <Row key={i.assignment_id} item={i} detail={relativeDue(i.due_at)} />
            ))}
          </Group>
          <Group title="Recently graded" empty="Nothing graded yet.">
            {summary.recentlyGraded.map((i) => (
              <Row
                key={i.assignment_id}
                item={i}
                detail={`${formatNumber(i.marks_obtained, 2)} / ${formatNumber(i.max_marks, 2)}`}
              />
            ))}
          </Group>
        </div>
      )}
    </Card>
  )
}
