import { Save } from 'lucide-react'
import { useId, useState } from 'react'

import { ApiError } from '../../lib/api'
import { gradeSubmission, type SubmissionRow } from '../../lib/assignments-api'
import { errorMessage, formatNumber } from '../../lib/format'
import { Button } from '../ui/Button'
import { Input } from '../ui/Field'

interface Props {
  assignmentId: number
  maxMarks: number
  row: SubmissionRow
  onSaved: (row: SubmissionRow) => void
}

function validate(value: string, max: number): string | null {
  const text = value.trim()
  if (text === '') return 'Enter marks.'
  const num = Number(text)
  if (!Number.isFinite(num)) return 'Enter a number.'
  if (num < 0) return 'Cannot be negative.'
  if (num > max) return `Cannot exceed ${formatNumber(max, 2)}.`
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'Use at most 2 decimal places.'
  return null
}

/** Inline grading for one student: marks (0 to max) and feedback, with its own save result. */
export function GradeCell({ assignmentId, maxMarks, row, onSaved }: Props) {
  const id = useId()
  const [marks, setMarks] = useState(row.marks_obtained === null ? '' : String(row.marks_obtained))
  const [feedback, setFeedback] = useState(row.feedback)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const name = row.student.name
  const dirty =
    marks.trim() !== (row.marks_obtained === null ? '' : String(row.marks_obtained)) || feedback !== row.feedback

  const save = async () => {
    const problem = validate(marks, maxMarks)
    setSaved(null)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setSaving(true)
    try {
      const updated = await gradeSubmission(assignmentId, row.student.id, {
        marks_obtained: Number(marks),
        feedback,
      })
      onSaved(updated)
      setSaved('Saved.')
    } catch (e) {
      const detail = e instanceof ApiError ? e.details.find((d) => d.field?.endsWith('marks_obtained')) : undefined
      setError(detail?.message ?? errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-w-72 flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="w-24 shrink-0">
          <label htmlFor={`${id}-marks`} className="sr-only">
            Marks for {name}, out of {formatNumber(maxMarks, 2)}
          </label>
          <Input
            id={`${id}-marks`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={maxMarks}
            placeholder={`/ ${formatNumber(maxMarks, 2)}`}
            value={marks}
            invalid={error !== null}
            aria-describedby={`${id}-status`}
            onChange={(event) => {
              setMarks(event.target.value)
              setError(null)
              setSaved(null)
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-fb`} className="sr-only">
            Feedback for {name}
          </label>
          <Input
            id={`${id}-fb`}
            value={feedback}
            maxLength={2000}
            placeholder="Feedback (optional)"
            onChange={(event) => {
              setFeedback(event.target.value)
              setSaved(null)
            }}
          />
        </div>
        <Button size="sm" variant={dirty ? 'primary' : 'secondary'} onClick={save} loading={saving} className="h-10">
          {!saving && <Save className="size-4" aria-hidden="true" />}
          Save
          <span className="sr-only"> grade for {name}</span>
        </Button>
      </div>
      <p
        id={`${id}-status`}
        role="status"
        aria-live="polite"
        className={error ? 'text-sm text-danger-ink' : 'text-sm text-accent-text'}
      >
        {error ?? saved}
      </p>
    </div>
  )
}
