import { RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'

import { ApiError } from '../../lib/api'
import { getMarks, updateMarks, type MarksSheetData } from '../../lib/faculty-api'
import { errorMessage, formatNumber, formatPercent } from '../../lib/format'
import { computeMarkStats, validateMark } from '../../lib/marks'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { Input } from '../ui/Field'
import { StatusMessage, type Notice } from '../ui/StatusMessage'
import { ErrorState, LoadingBlock } from '../ui/States'
import { DataTable, type Column } from './DataTable'
import { StatusBadge } from './StatusBadge'

interface Row {
  studentId: number
  roll: string
  name: string
  value: string
  absent: boolean
}

function toRows(sheet: MarksSheetData): Row[] {
  return sheet.marks.map((m) => ({
    studentId: m.student.id,
    roll: m.student.roll_no,
    name: m.student.name,
    value: m.marks_obtained === null ? '' : String(m.marks_obtained),
    absent: m.is_absent,
  }))
}

const sameRows = (a: readonly Row[], b: readonly Row[]) =>
  a.length === b.length && a.every((row, i) => row.value === b[i]?.value && row.absent === b[i]?.absent)

/** Loads the marks for one assessment and renders the editable sheet. */
export function MarksSheet({ assessmentId }: { assessmentId: number }) {
  const state = useAsyncData(`marks:${assessmentId}`, () => getMarks(assessmentId))
  if (state.error) return <ErrorState message={errorMessage(state.error)} onRetry={state.reload} />
  if (!state.data) return <LoadingBlock label="Loading marks…" rows={6} />
  return <MarksEditor key={assessmentId} sheet={state.data} />
}

function MarksEditor({ sheet }: { sheet: MarksSheetData }) {
  const { assessment } = sheet
  const max = assessment.max_marks

  const [baseline, setBaseline] = useState<Row[]>(() => toRows(sheet))
  const [rows, setRows] = useState<Row[]>(baseline)
  const [serverErrors, setServerErrors] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const errorFor = (row: Row): string | null =>
    serverErrors[row.studentId] ?? validateMark(row.value, row.absent, max)
  const hasInvalid = rows.some((row) => validateMark(row.value, row.absent, max) !== null)
  const dirty = !sameRows(rows, baseline)
  const stats = computeMarkStats(rows, max)

  const patch = (studentId: number, change: Partial<Row>) => {
    setNotice(null)
    setServerErrors((prev) => {
      if (!(studentId in prev)) return prev
      const next = { ...prev }
      delete next[studentId]
      return next
    })
    setRows((prev) => prev.map((row) => (row.studentId === studentId ? { ...row, ...change } : row)))
  }

  const reset = () => {
    setRows(baseline)
    setServerErrors({})
    setNotice({ tone: 'info', text: 'Unsaved changes discarded.' })
  }

  const save = async () => {
    if (hasInvalid) {
      setNotice({ tone: 'error', text: 'Fix the highlighted marks before saving.' })
      return
    }
    setSaving(true)
    setNotice(null)
    setServerErrors({})
    try {
      const saved = await updateMarks(
        assessment.id,
        rows.map((row) => ({
          student_id: row.studentId,
          marks_obtained: row.absent || row.value.trim() === '' ? null : Number(row.value),
          is_absent: row.absent,
        })),
      )
      const fresh = toRows(saved)
      setBaseline(fresh)
      setRows(fresh)
      setNotice({ tone: 'success', text: 'Marks saved.' })
    } catch (error) {
      // Server details look like "marks.3.marks_obtained": the index is the row we sent.
      if (error instanceof ApiError && error.details.length > 0) {
        const perRow: Record<number, string> = {}
        for (const detail of error.details) {
          const index = Number(/^marks\.(\d+)\./.exec(detail.field ?? '')?.[1])
          const row = rows[index]
          if (row) perRow[row.studentId] = detail.message
        }
        setServerErrors(perRow)
      }
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<Row>[] = [
    { key: 'roll', header: 'Roll no.', cell: (r) => <span className="whitespace-nowrap">{r.roll}</span> },
    { key: 'name', header: 'Student', cell: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'marks',
      header: `Marks (out of ${formatNumber(max, 2)})`,
      cell: (r) => {
        const error = errorFor(r)
        const errorId = `mark-error-${r.studentId}`
        return (
          <div className="w-32">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={max}
              value={r.value}
              disabled={r.absent}
              invalid={error !== null}
              aria-label={`Marks for ${r.name}`}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => patch(r.studentId, { value: event.target.value })}
            />
            {error && (
              <p id={errorId} className="mt-1 text-xs text-danger-ink">
                {error}
              </p>
            )}
          </div>
        )
      },
    },
    {
      key: 'absent',
      header: 'Absent',
      align: 'center',
      cell: (r) => (
        <input
          type="checkbox"
          checked={r.absent}
          aria-label={`${r.name} was absent`}
          onChange={(event) => patch(r.studentId, { absent: event.target.checked, value: '' })}
          className="size-5 accent-[var(--accent)]"
        />
      ),
    },
    {
      key: 'percent',
      header: '%',
      align: 'right',
      cell: (r) =>
        r.absent || r.value.trim() === '' || validateMark(r.value, false, max) !== null ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="tabular-nums">{formatPercent((Number(r.value) / max) * 100)}</span>
        ),
    },
    {
      key: 'state',
      header: 'Status',
      cell: (r) =>
        errorFor(r) ? (
          <StatusBadge tone="danger">Invalid</StatusBadge>
        ) : r.absent ? (
          <StatusBadge tone="warning">Absent</StatusBadge>
        ) : r.value.trim() === '' ? (
          <StatusBadge>Not graded</StatusBadge>
        ) : (
          <StatusBadge tone="accent">Graded</StatusBadge>
        ),
    },
  ]

  const tiles = [
    {
      label: 'Class average',
      value: stats.average === null ? '—' : `${formatNumber(stats.average, 2)} / ${formatNumber(max, 2)}`,
      caption: stats.averagePercent === null ? undefined : formatPercent(stats.averagePercent),
    },
    { label: 'Highest', value: stats.high === null ? '—' : formatNumber(stats.high, 2) },
    { label: 'Lowest', value: stats.low === null ? '—' : formatNumber(stats.low, 2) },
    {
      label: 'Entered',
      value: formatPercent(stats.completion, 0),
      caption: `${stats.graded} graded, ${stats.absent} absent of ${stats.total}`,
    },
  ]

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Marks summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-sm text-muted">{tile.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink tabular-nums">{tile.value}</p>
            {tile.caption && <p className="text-xs text-muted">{tile.caption}</p>}
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title={assessment.title}
          subtitle={`Out of ${formatNumber(max, 2)} · blank means not graded yet`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {dirty && <span className="text-sm text-accent-text">Unsaved changes</span>}
              <Button size="sm" onClick={reset} disabled={!dirty}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </Button>
              <Button size="sm" variant="primary" onClick={save} loading={saving} disabled={!dirty}>
                {!saving && <Save className="size-4" aria-hidden="true" />}
                Save marks
              </Button>
            </div>
          }
        />
        <StatusMessage notice={notice} className="px-5" spaced />
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">No students are enrolled in this class.</p>
        ) : (
          <DataTable caption={`Marks for ${assessment.title}`} columns={columns} rows={rows} rowKey={(r) => r.studentId} />
        )}
      </Card>
    </div>
  )
}
