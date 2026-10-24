import { ArrowLeft, Download, FileDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { GradeCell } from '../../components/assignments/GradeCell'
import { StatusChip } from '../../components/assignments/StatusChip'
import { TimingLine } from '../../components/assignments/TimingLine'
import { DataTable, type Column } from '../../components/faculty/DataTable'
import { PageTitle } from '../../components/faculty/PageTitle'
import { StatusBadge } from '../../components/faculty/StatusBadge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { SelectField } from '../../components/ui/SelectField'
import { StatusMessage, type Notice } from '../../components/ui/StatusMessage'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import {
  downloadSubmissionFile,
  downloadSubmissionsCsv,
  getAssignment,
  listAllSubmissions,
  type SubmissionRow,
} from '../../lib/assignments-api'
import { cn } from '../../lib/cn'
import { errorMessage, formatNumber } from '../../lib/format'
import { formatBytes } from '../../lib/upload-limits'
import { formatDue } from '../../lib/timing'

type Filter = 'all' | 'submitted' | 'late' | 'missing' | 'graded'
type Sort = 'roll' | 'earliest' | 'latest'

const FILTERS: ReadonlyArray<{ id: Filter; label: string; test: (r: SubmissionRow) => boolean }> = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'submitted', label: 'Submitted', test: (r) => r.submitted_at !== null },
  { id: 'late', label: 'Late', test: (r) => r.timing === 'LATE' },
  { id: 'missing', label: 'Missing', test: (r) => r.submitted_at === null },
  { id: 'graded', label: 'Graded', test: (r) => r.status === 'GRADED' },
]

const SORTS = [
  { value: 'roll', label: 'Roll number' },
  { value: 'earliest', label: 'Submitted: earliest first' },
  { value: 'latest', label: 'Submitted: latest first' },
]

function sortRows(rows: readonly SubmissionRow[], sort: Sort): SubmissionRow[] {
  if (sort === 'roll') return [...rows]
  const time = (r: SubmissionRow) => (r.submitted_at ? new Date(r.submitted_at).getTime() : null)
  return [...rows].sort((a, b) => {
    const ta = time(a)
    const tb = time(b)
    if (ta === null && tb === null) return 0
    if (ta === null) return 1 // missing work always last
    if (tb === null) return -1
    return sort === 'earliest' ? ta - tb : tb - ta
  })
}

export function AssignmentDetailPage() {
  const { assignmentId } = useParams()
  const id = Number(assignmentId)
  const valid = Number.isInteger(id) && id > 0

  const assignment = useAsyncData(valid ? `assignment:${id}` : null, () => getAssignment(id))
  const submissions = useAsyncData(valid ? `submissions:${id}` : null, () => listAllSubmissions(id))

  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('roll')
  const [saved, setSaved] = useState<Record<number, SubmissionRow>>({})
  const [downloading, setDownloading] = useState<number | 'csv' | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const rows = useMemo(
    () => (submissions.data ?? []).map((r) => saved[r.student.id] ?? r),
    [submissions.data, saved],
  )
  const visible = useMemo(() => {
    const test = FILTERS.find((f) => f.id === filter)?.test ?? (() => true)
    return sortRows(rows.filter(test), sort)
  }, [rows, filter, sort])

  const a = assignment.data

  const download = async (row: SubmissionRow) => {
    if (!a || !row.original_name) return
    setDownloading(row.student.id)
    setNotice(null)
    try {
      await downloadSubmissionFile(a.id, row.student.id, row.original_name)
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setDownloading(null)
    }
  }

  const exportCsv = async () => {
    if (!a) return
    setDownloading('csv')
    setNotice(null)
    try {
      await downloadSubmissionsCsv(a)
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setDownloading(null)
    }
  }

  const columns: Column<SubmissionRow>[] = [
    {
      key: 'student',
      header: 'Student',
      cell: (r) => (
        <>
          <span className="font-medium">{r.student.name}</span>
          <span className="block text-xs text-muted">{r.student.roll_no}</span>
        </>
      ),
    },
    { key: 'status', header: 'Status', cell: (r) => <StatusChip status={r.status} /> },
    {
      key: 'submitted',
      header: 'Submitted',
      cell: (r) =>
        r.submitted_at === null ? (
          <span className="text-muted">Nothing submitted</span>
        ) : (
          <TimingLine offsetSeconds={r.offset_seconds} submittedAt={r.submitted_at} />
        ),
    },
    {
      key: 'file',
      header: 'File',
      cell: (r) =>
        r.original_name === null ? (
          <span className="text-muted">—</span>
        ) : (
          <div className="max-w-56">
            <p className="truncate text-sm font-medium" title={r.original_name}>
              {r.original_name}
            </p>
            <p className="text-xs text-muted">{r.size === null ? '' : formatBytes(r.size)}</p>
            {r.note && <p className="mt-1 text-xs text-muted">Note: {r.note}</p>}
            <Button size="sm" className="mt-1.5" onClick={() => download(r)} loading={downloading === r.student.id}>
              {downloading !== r.student.id && <Download className="size-4" aria-hidden="true" />}
              Download
              <span className="sr-only"> {r.original_name} from {r.student.name}</span>
            </Button>
          </div>
        ),
    },
    {
      key: 'grade',
      header: 'Marks and feedback',
      cell: (r) =>
        r.submitted_at === null || !a ? (
          <span className="text-muted">Nothing to grade</span>
        ) : (
          <GradeCell
            key={`${r.student.id}-${r.graded_at ?? 'new'}`}
            assignmentId={a.id}
            maxMarks={a.max_marks}
            row={r}
            onSaved={(updated) => {
              setSaved((prev) => ({ ...prev, [updated.student.id]: updated }))
              assignment.reload()
            }}
          />
        ),
    },
  ]

  if (!valid) {
    return (
      <Card>
        <EmptyState title="Assignment not found" body="Check the link, or go back to your assignments." />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to={a ? `/faculty/assignments?class=${a.teaching_assignment_id}` : '/faculty/assignments'}
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All assignments
      </Link>

      {assignment.error ? (
        <Card>
          <ErrorState message={errorMessage(assignment.error)} onRetry={assignment.reload} />
        </Card>
      ) : !a ? (
        <Card>
          <LoadingBlock label="Loading assignment…" rows={3} />
        </Card>
      ) : (
        <>
          <PageTitle
            title={a.title}
            subtitle={`${a.subject.code} · section ${a.section.name} · due ${formatDue(a.due_at)}`}
            action={
              <Button onClick={exportCsv} loading={downloading === 'csv'}>
                {downloading !== 'csv' && <FileDown className="size-4" aria-hidden="true" />}
                Export CSV
              </Button>
            }
          />

          <Card className="p-5">
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
              <div>
                <dt className="text-muted">Submitted</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                  {a.submitted_count} / {a.total_students}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Late</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{a.late_count}</dd>
              </div>
              <div>
                <dt className="text-muted">Graded</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                  {a.graded_count} / {a.submitted_count}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Maximum marks</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatNumber(a.max_marks, 2)}</dd>
              </div>
              <div>
                <dt className="text-muted">Late work</dt>
                <dd className="mt-1">
                  <StatusBadge tone={a.allow_late_submissions ? 'neutral' : 'warning'}>
                    {a.allow_late_submissions ? 'Accepted, marked late' : 'Closed at the deadline'}
                  </StatusBadge>
                </dd>
              </div>
            </dl>
            {a.description && <p className="mt-4 border-t border-line pt-4 text-sm whitespace-pre-line text-muted">{a.description}</p>}
          </Card>
        </>
      )}

      <StatusMessage notice={notice} />

      <Card>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div role="group" aria-label="Filter submissions" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const count = rows.filter(f.test).length
              const active = filter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-accent bg-accent-soft text-accent-text'
                      : 'border-line bg-surface text-ink hover:bg-surface-alt',
                  )}
                >
                  {f.label}
                  <span className="text-xs tabular-nums text-muted">{count}</span>
                </button>
              )
            })}
          </div>
          <SelectField
            label="Sort by"
            value={sort}
            onChange={(next) => setSort(next as Sort)}
            options={SORTS}
            className="lg:w-64"
          />
        </div>

        {submissions.error ? (
          <ErrorState message={errorMessage(submissions.error)} onRetry={submissions.reload} />
        ) : submissions.loading ? (
          <LoadingBlock label="Loading submissions…" rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState title="No students in this class" body="Students appear here once they are enrolled in the subject." />
        ) : visible.length === 0 ? (
          <EmptyState title="Nobody matches this filter" body="Choose another filter to see more students." />
        ) : (
          <DataTable caption="Submissions for this assignment" columns={columns} rows={visible} rowKey={(r) => r.student.id} />
        )}
      </Card>
    </div>
  )
}
