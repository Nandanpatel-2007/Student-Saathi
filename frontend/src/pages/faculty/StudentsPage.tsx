import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { ClassPicker } from '../../components/faculty/ClassPicker'
import { DataTable, type Column } from '../../components/faculty/DataTable'
import { ExportButtons } from '../../components/faculty/ExportButtons'
import { PageTitle } from '../../components/faculty/PageTitle'
import { AlertChips } from '../../components/faculty/StatusBadge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DiffIndicator } from '../../components/ui/DiffIndicator'
import { Input } from '../../components/ui/Field'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useSelectedClass } from '../../hooks/useSelectedClass'
import { compareDiff } from '../../lib/compare'
import { getClassSummary, listClassStudents, type ClassStudent } from '../../lib/faculty-api'
import { errorMessage, formatPercent } from '../../lib/format'

const PAGE_SIZE = 20

/** Column title with the class average underneath, e.g. "Attendance / Class avg 76%". */
function ColumnTitle({ title, classAvg, align }: { title: string; classAvg: number | null | undefined; align?: 'right' }) {
  return (
    <span className={align === 'right' ? 'block text-right' : 'block'}>
      {title}
      <span className="block text-xs font-normal tracking-normal text-muted normal-case">
        Class avg {classAvg === undefined ? '…' : classAvg === null ? 'No data yet' : formatPercent(classAvg)}
      </span>
    </span>
  )
}

function classesNeeded(value: number | null): string {
  if (value === null) return '—'
  if (value === 0) return 'None'
  return `${value} class${value === 1 ? '' : 'es'}`
}

export function StudentsPage() {
  const { classes, selected, value, setClass } = useSelectedClass({ allowAll: false })
  const searchId = useId()
  const [query, setQuery] = useState('')
  // The page number belongs to one class; switching class starts again from page 1.
  const [paging, setPaging] = useState({ classId: -1, page: 1 })
  const classId = selected?.assignment_id ?? -1
  const page = paging.classId === classId ? paging.page : 1

  const students = useAsyncData(selected ? `students:${classId}:${page}` : null, () =>
    listClassStudents(classId, { page, pageSize: PAGE_SIZE }),
  )

  // Class averages for the column headers (the per-student rows only carry the differences).
  const summary = useAsyncData(selected ? `students-summary:${classId}` : null, () => getClassSummary(classId))

  const rows = useMemo(() => {
    const items = students.data?.items ?? []
    const needle = query.trim().toLowerCase()
    return needle
      ? items.filter((r) => `${r.student.name} ${r.student.roll_no}`.toLowerCase().includes(needle))
      : items
  }, [students.data, query])

  const columns: Column<ClassStudent>[] = [
    { key: 'roll', header: 'Roll no.', cell: (r) => <span className="whitespace-nowrap">{r.student.roll_no}</span> },
    { key: 'name', header: 'Student', cell: (r) => <span className="font-medium">{r.student.name}</span> },
    {
      key: 'attendance',
      header: <ColumnTitle title="Attendance" classAvg={summary.data?.attendance_pct} />,
      cell: (r) =>
        r.attendance_pct === null ? (
          <span className="text-muted">No data yet</span>
        ) : (
          <>
            <span className="font-medium tabular-nums">{formatPercent(r.attendance_pct)}</span>
            <span className="block text-xs whitespace-nowrap text-muted tabular-nums">
              {r.present}P · {r.absent}A · {r.late}L · {r.excused}E
            </span>
          </>
        ),
    },
    {
      key: 'attendanceDiff',
      header: 'vs class',
      cell: (r) => <DiffIndicator comparison={compareDiff(r.diff_from_class_attendance)} />,
    },
    {
      key: 'score',
      header: <ColumnTitle title="Avg marks" classAvg={summary.data?.average_score_pct} align="right" />,
      align: 'right',
      cell: (r) =>
        r.average_score_pct === null ? (
          <span className="text-muted">No data yet</span>
        ) : (
          <span className="font-medium tabular-nums">{formatPercent(r.average_score_pct)}</span>
        ),
    },
    {
      key: 'scoreDiff',
      header: 'vs class',
      cell: (r) => <DiffIndicator comparison={compareDiff(r.diff_from_class_score)} />,
    },
    {
      key: 'needed',
      header: 'Classes needed',
      cell: (r) => <span className="whitespace-nowrap">{classesNeeded(r.classes_needed_for_threshold)}</span>,
    },
    { key: 'alerts', header: 'Alerts', cell: (r) => <AlertChips alerts={r.alerts} /> },
  ]

  const data = students.data
  const goTo = (next: number) => setPaging({ classId, page: next })

  return (
    <div className="space-y-6">
      <PageTitle
        title="Students"
        subtitle="Each student’s attendance and average marks, compared with the class average."
        action={selected ? <ExportButtons cls={selected} /> : undefined}
      />

      <Card>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <ClassPicker classes={classes} value={value} onChange={setClass} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={searchId} className="text-sm font-medium text-ink">
              Search this page
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input
                id={searchId}
                type="search"
                value={query}
                placeholder="Name or roll number"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </div>

        {students.error ? (
          <ErrorState message={errorMessage(students.error)} onRetry={students.reload} />
        ) : students.loading ? (
          <LoadingBlock label="Loading students…" rows={6} />
        ) : !data || data.count === 0 ? (
          <EmptyState title="No students in this class" body="Students appear once they are enrolled in the subject." />
        ) : rows.length === 0 ? (
          <EmptyState title="No matches on this page" body="Try a different name or roll number, or change page." />
        ) : (
          <DataTable caption="Students in the selected class" columns={columns} rows={rows} rowKey={(r) => r.student.id} />
        )}

        {data && data.count > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="text-sm text-muted" aria-live="polite">
              Page {data.page} of {Math.max(data.total_pages, 1)} · {data.count} student{data.count === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => goTo(page - 1)} disabled={page <= 1 || students.loading}>
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <Button size="sm" onClick={() => goTo(page + 1)} disabled={page >= data.total_pages || students.loading}>
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
