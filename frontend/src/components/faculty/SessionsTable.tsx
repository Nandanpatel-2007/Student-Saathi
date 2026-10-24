import { formatDate } from '../../lib/format'
import type { SessionSummary } from '../../lib/faculty-api'
import { Button } from '../ui/Button'
import { DataTable, type Column } from './DataTable'

interface Props {
  sessions: readonly SessionSummary[]
  caption: string
  /** Show the subject/section column (useful when several classes are listed together). */
  showClass?: boolean
  onOpen?: (session: SessionSummary) => void
}

export function SessionsTable({ sessions, caption, showClass = false, onOpen }: Props) {
  const columns: Column<SessionSummary>[] = [
    { key: 'date', header: 'Date', cell: (s) => <span className="whitespace-nowrap">{formatDate(s.date)}</span> },
    { key: 'period', header: 'Period', cell: (s) => s.period },
    ...(showClass
      ? [
          {
            key: 'class',
            header: 'Class',
            cell: (s: SessionSummary) => (
              <>
                <span className="font-medium">{s.subject.code}</span>
                <span className="text-muted"> · {s.section.name}</span>
              </>
            ),
          },
        ]
      : [{ key: 'topic', header: 'Topic', cell: (s: SessionSummary) => s.topic || <span className="text-muted">—</span> }]),
    {
      key: 'counts',
      header: 'Present / Absent / Late / Excused',
      cell: (s) => (
        <span className="whitespace-nowrap tabular-nums">
          {s.present} / {s.absent} / {s.late} / {s.excused}
          <span className="text-muted"> of {s.total}</span>
        </span>
      ),
    },
    ...(onOpen
      ? [
          {
            key: 'open',
            header: <span className="sr-only">Actions</span>,
            align: 'right' as const,
            cell: (s: SessionSummary) => (
              <Button size="sm" onClick={() => onOpen(s)}>
                Open
                <span className="sr-only"> session on {formatDate(s.date)}, period {s.period}</span>
              </Button>
            ),
          },
        ]
      : []),
  ]
  return <DataTable columns={columns} rows={sessions} rowKey={(s) => s.id} caption={caption} />
}
