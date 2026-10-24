import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { withdrawSubmission, type StudentAssignment } from '../../lib/assignments-api'
import { submitBlockedReason } from '../../lib/assignments-derive'
import { errorMessage, formatNumber } from '../../lib/format'
import { formatDue } from '../../lib/timing'
import { formatBytes } from '../../lib/upload-limits'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { StatusChip } from './StatusChip'
import { SubmitPanel } from './SubmitPanel'
import { TimingLine } from './TimingLine'

interface Props {
  item: StudentAssignment
  onChanged: (item: StudentAssignment) => void
  /** The submission was removed; the list should be reloaded. */
  onWithdrawn: () => void
}

export function StudentAssignmentCard({ item, onChanged, onWithdrawn }: Props) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blocked = submitBlockedReason(item)
  const canWithdraw = item.submission !== null && item.status !== 'GRADED'
  const graded = item.status === 'GRADED' && item.marks_obtained !== null

  const withdraw = async () => {
    setBusy(true)
    setError(null)
    try {
      await withdrawSubmission(item.assignment_id)
      setConfirming(false)
      setOpen(false)
      onWithdrawn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-accent-text">
            {item.subject.code} · {item.subject.name}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold text-ink">{item.title}</h3>
        </div>
        <StatusChip status={item.status} />
      </div>

      <p className="mt-2 text-sm text-muted">
        Due {formatDue(item.due_at)} · out of {formatNumber(item.max_marks, 2)}
        {!item.allow_late_submissions && ' · no late submissions'}
      </p>
      {item.description && <p className="mt-3 text-sm whitespace-pre-line text-ink">{item.description}</p>}

      {item.submission && (
        <div className="mt-4 rounded-lg bg-surface-alt p-3 text-sm">
          <p className="font-medium text-ink">
            Your submission: {item.submission.original_name}{' '}
            <span className="font-normal text-muted">({formatBytes(item.submission.size)})</span>
          </p>
          <TimingLine offsetSeconds={item.offset_seconds} submittedAt={item.submission.submitted_at} className="mt-1" />
          {item.submission.note && <p className="mt-1 text-muted">Your note: {item.submission.note}</p>}
        </div>
      )}

      {graded && (
        <div className="mt-4 rounded-lg border border-line p-3">
          <p className="text-sm text-muted">Marks</p>
          <p className="font-display text-2xl font-semibold text-ink tabular-nums">
            {formatNumber(item.marks_obtained, 2)}{' '}
            <span className="text-base font-normal text-muted">/ {formatNumber(item.max_marks, 2)}</span>
          </p>
          {item.feedback ? (
            <p className="mt-2 text-sm whitespace-pre-line text-ink">
              <span className="font-medium">Feedback: </span>
              {item.feedback}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">No written feedback.</p>
          )}
        </div>
      )}

      <div className="mt-4">
        {blocked ? (
          <p className="text-sm text-muted">{blocked}</p>
        ) : open ? (
          <div className="rounded-lg border border-line p-4">
            <SubmitPanel
              assignment={item}
              onSubmitted={(updated) => {
                onChanged(updated)
                setOpen(false)
              }}
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant={item.submission ? 'secondary' : 'primary'} onClick={() => setOpen(true)}>
              {item.submission ? 'Replace submission' : 'Submit work'}
            </Button>
            {canWithdraw && (
              <Button onClick={() => setConfirming(true)}>
                <Trash2 className="size-4" aria-hidden="true" />
                Remove submission
              </Button>
            )}
          </div>
        )}
        {open && !blocked && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Remove your submission?"
        confirmLabel="Remove submission"
        busy={busy}
        error={error}
        onConfirm={withdraw}
        onClose={() => {
          setConfirming(false)
          setError(null)
        }}
      >
        <p>
          Your uploaded file for “{item.title}” will be deleted. You can submit again
          {item.allow_late_submissions ? ', but anything after the deadline is marked late.' : ' until the deadline.'}
        </p>
      </ConfirmDialog>
    </Card>
  )
}
