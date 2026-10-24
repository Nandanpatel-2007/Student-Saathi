import { PlayCircle } from 'lucide-react'
import { useId, useState } from 'react'

import { AttendanceSheet } from '../../components/faculty/AttendanceSheet'
import { ClassPicker } from '../../components/faculty/ClassPicker'
import { PageTitle } from '../../components/faculty/PageTitle'
import { SessionsTable } from '../../components/faculty/SessionsTable'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { SelectField } from '../../components/ui/SelectField'
import { StatusMessage, type Notice } from '../../components/ui/StatusMessage'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useSelectedClass } from '../../hooks/useSelectedClass'
import { ApiError } from '../../lib/api'
import {
  createSession,
  findClassSession,
  getSession,
  listClassSessions,
  type FacultyClass,
  type SessionDetail,
  type SessionSummary,
} from '../../lib/faculty-api'
import { errorMessage, formatDate, todayISO } from '../../lib/format'

const PERIODS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Period ${i + 1}` }))

export function AttendancePage() {
  const { classes, selected, value, setClass } = useSelectedClass({ allowAll: false })
  const dateId = useId()
  const topicId = useId()
  const today = todayISO()

  const [date, setDate] = useState(today)
  const [period, setPeriod] = useState('1')
  const [topic, setTopic] = useState('')
  const [opened, setOpened] = useState<SessionDetail | null>(null)
  const [starting, setStarting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  // Only show a loaded session while its class is still the selected one.
  const session = opened && selected && opened.teaching_assignment_id === selected.assignment_id ? opened : null

  const history = useAsyncData(selected ? `attendance-history:${selected.assignment_id}` : null, () =>
    selected ? listClassSessions(selected) : Promise.resolve([]),
  )

  const dateError = date > today ? 'Choose today or an earlier date.' : date === '' ? 'Choose a date.' : null

  const openExisting = async (summary: SessionSummary, text: string) => {
    setOpened(await getSession(summary.id))
    setNotice({ tone: 'info', text })
  }

  const startOrOpen = async (cls: FacultyClass) => {
    if (dateError) {
      setNotice({ tone: 'error', text: dateError })
      return
    }
    setStarting(true)
    setNotice(null)
    const periodNumber = Number(period)
    const existsText = `Opened the existing session for ${formatDate(date)}, period ${periodNumber}.`
    try {
      const existing = await findClassSession(cls, date, periodNumber)
      if (existing) {
        await openExisting(existing, existsText)
        return
      }
      try {
        const created = await createSession({
          teaching_assignment_id: cls.assignment_id,
          date,
          period: periodNumber,
          topic: topic.trim() || undefined,
        })
        setOpened(created)
        setNotice({ tone: 'success', text: 'Session started. Everyone is marked present; change the exceptions and save.' })
        history.reload()
      } catch (error) {
        // Someone (or another tab) created it between our lookup and the POST.
        if (error instanceof ApiError && error.status === 409) {
          const raced = await findClassSession(cls, date, periodNumber)
          if (raced) {
            await openExisting(raced, existsText)
            return
          }
        }
        throw error
      }
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setStarting(false)
    }
  }

  const openFromHistory = async (summary: SessionSummary) => {
    setNotice(null)
    setStarting(true)
    try {
      setDate(summary.date)
      setPeriod(String(summary.period))
      setTopic(summary.topic)
      await openExisting(summary, `Opened the session from ${formatDate(summary.date)}, period ${summary.period}.`)
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Attendance" subtitle="Start a class session, mark exceptions and save." />

      <Card>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-12">
          <ClassPicker classes={classes} value={value} onChange={setClass} className="lg:col-span-4" />
          <Field label="Date" htmlFor={dateId} error={dateError} className="lg:col-span-2">
            <Input
              id={dateId}
              type="date"
              max={today}
              value={date}
              invalid={dateError !== null}
              aria-describedby={dateError ? `${dateId}-msg` : undefined}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <SelectField label="Period" value={period} onChange={setPeriod} options={PERIODS} className="lg:col-span-2" />
          <Field label="Topic (optional)" htmlFor={topicId} className="lg:col-span-4">
            <Input
              id={topicId}
              value={topic}
              maxLength={200}
              placeholder="e.g. Binary trees"
              onChange={(event) => setTopic(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
          <Button
            variant="primary"
            loading={starting}
            disabled={!selected || dateError !== null}
            onClick={() => selected && startOrOpen(selected)}
          >
            {!starting && <PlayCircle className="size-4" aria-hidden="true" />}
            Start / open session
          </Button>
          <p className="text-sm text-muted">Opens the session if one exists for this class, date and period.</p>
        </div>
        <StatusMessage notice={notice} className="px-5" spaced />
      </Card>

      {session && <AttendanceSheet key={session.id} session={session} onSaved={(updated) => { setOpened(updated); history.reload() }} />}

      <Card>
        <CardHeader title="Session history" subtitle="Present / absent / late / excused counts for each recorded class" />
        {history.error ? (
          <ErrorState message={errorMessage(history.error)} onRetry={history.reload} />
        ) : history.loading ? (
          <LoadingBlock label="Loading history…" rows={4} />
        ) : !history.data || history.data.length === 0 ? (
          <EmptyState title="No sessions yet for this class" body="Start the first one above." />
        ) : (
          <SessionsTable
            sessions={history.data}
            caption="Attendance session history for the selected class"
            onOpen={openFromHistory}
          />
        )}
      </Card>
    </div>
  )
}
