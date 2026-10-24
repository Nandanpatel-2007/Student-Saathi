import { CheckCheck, RotateCcw, Save } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '../../lib/cn'
import {
  ATTENDANCE_STATUSES,
  updateRecords,
  type AttendanceStatus,
  type SessionDetail,
} from '../../lib/faculty-api'
import { errorMessage, formatDate } from '../../lib/format'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { StatusMessage, type Notice } from '../ui/StatusMessage'
import { DataTable, type Column } from './DataTable'

type RecordRow = SessionDetail['records'][number]

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  EXCUSED: 'Excused',
}

// Selected-state colours, drawn from the theme tokens.
const STATUS_ACTIVE: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-accent-soft text-accent-text border-accent-text/40',
  ABSENT: 'bg-danger-bg text-danger-ink border-danger-line',
  LATE: 'bg-warn-bg text-warn-ink border-warn-bar/50',
  EXCUSED: 'bg-surface-alt text-ink border-ink/30',
}


interface Props {
  session: SessionDetail
  onSaved: (session: SessionDetail) => void
}

export function AttendanceSheet({ session, onSaved }: Props) {
  /** Unsaved choices: student id -> status. Absent key = unchanged from the server. */
  const [drafts, setDrafts] = useState<Record<number, AttendanceStatus>>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const statusOf = (record: RecordRow): AttendanceStatus => drafts[record.student.id] ?? record.status
  const changedIds = session.records.filter((r) => drafts[r.student.id] !== undefined && drafts[r.student.id] !== r.status)

  const counts = useMemo(() => {
    const tally: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
    for (const record of session.records) tally[drafts[record.student.id] ?? record.status] += 1
    return tally
  }, [session.records, drafts])

  const setStatus = (studentId: number, status: AttendanceStatus) => {
    setNotice(null)
    setDrafts((prev) => ({ ...prev, [studentId]: status }))
  }

  const markAllPresent = () => {
    setNotice(null)
    setDrafts(Object.fromEntries(session.records.map((r) => [r.student.id, 'PRESENT' as const])))
  }

  const reset = () => {
    setDrafts({})
    setNotice({ tone: 'info', text: 'Unsaved changes discarded.' })
  }

  const save = async () => {
    const payload = changedIds.map((r) => ({
      student_id: r.student.id,
      status: drafts[r.student.id] ?? r.status,
    }))
    if (payload.length === 0) {
      setNotice({ tone: 'info', text: 'No changes to save.' })
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      const updated = await updateRecords(session.id, payload)
      setDrafts({})
      onSaved(updated)
      setNotice({
        tone: 'success',
        text: `Saved ${payload.length} change${payload.length === 1 ? '' : 's'}.`,
      })
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<RecordRow>[] = [
    { key: 'roll', header: 'Roll no.', cell: (r) => <span className="whitespace-nowrap">{r.student.roll_no}</span> },
    {
      key: 'name',
      header: 'Student',
      cell: (r) => (
        <>
          <span className="font-medium">{r.student.name}</span>
          {drafts[r.student.id] !== undefined && drafts[r.student.id] !== r.status && (
            <span className="ml-2 text-xs text-accent-text">Changed</span>
          )}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">Attendance for {r.student.name}</legend>
          <div className="inline-flex flex-wrap gap-1.5">
            {ATTENDANCE_STATUSES.map((status) => {
              const active = statusOf(r) === status
              return (
                <label key={status} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name={`status-${r.student.id}`}
                    value={status}
                    checked={active}
                    onChange={() => setStatus(r.student.id, status)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      'inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring',
                      active ? STATUS_ACTIVE[status] : 'border-line text-muted hover:bg-surface-alt',
                    )}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ),
    },
  ]

  const tiles: Array<{ label: string; value: number; className?: string }> = [
    { label: 'Students', value: session.records.length },
    { label: 'Present', value: counts.PRESENT, className: 'text-accent-text' },
    { label: 'Absent', value: counts.ABSENT, className: 'text-danger-ink' },
    { label: 'Late', value: counts.LATE, className: 'text-warn-ink' },
    { label: 'Excused', value: counts.EXCUSED },
  ]

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Attendance summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-sm text-muted">{tile.label}</p>
            <p className={cn('mt-1 font-display text-2xl font-semibold text-ink tabular-nums', tile.className)}>
              {tile.value}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title={`${session.subject.code} · ${session.section.name}`}
          subtitle={`${formatDate(session.date)} · Period ${session.period}${session.topic ? ` · ${session.topic}` : ''}`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={markAllPresent}>
                <CheckCheck className="size-4" aria-hidden="true" />
                Mark all present
              </Button>
              <Button size="sm" onClick={reset} disabled={changedIds.length === 0}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </Button>
              <Button size="sm" variant="primary" onClick={save} loading={saving}>
                {!saving && <Save className="size-4" aria-hidden="true" />}
                Save{changedIds.length > 0 ? ` (${changedIds.length})` : ''}
              </Button>
            </div>
          }
        />
        <StatusMessage notice={notice} className="px-5" spaced />
        {session.records.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">No enrolled students in this session.</p>
        ) : (
          <DataTable
            caption="Student attendance for this session"
            columns={columns}
            rows={session.records}
            rowKey={(r) => r.student.id}
          />
        )}
      </Card>
    </div>
  )
}
