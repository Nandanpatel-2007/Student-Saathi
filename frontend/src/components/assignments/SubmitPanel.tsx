import { FileUp, LoaderCircle } from 'lucide-react'
import { useId, useState, type DragEvent } from 'react'

import { submitAssignment, type StudentAssignment } from '../../lib/assignments-api'
import { cn } from '../../lib/cn'
import { errorMessage } from '../../lib/format'
import { ACCEPT_ATTRIBUTE, ALLOWED_LABEL, MAX_UPLOAD_MB, formatBytes, validateFile } from '../../lib/upload-limits'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Field'
import { StatusMessage, type Notice } from '../ui/StatusMessage'

interface Props {
  assignment: StudentAssignment
  onSubmitted: (item: StudentAssignment) => void
}

/** File picker with drag-and-drop, optional note and a clear busy state. The server sets the time. */
export function SubmitPanel({ assignment, onSubmitted }: Props) {
  const inputId = useId()
  const noteId = useId()
  const errorId = useId()
  const replacing = assignment.submission !== null

  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState(assignment.submission?.note ?? '')
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const choose = (candidate: File | undefined) => {
    setNotice(null)
    if (!candidate) return
    const problem = validateFile(candidate)
    setFileError(problem)
    setFile(problem ? null : candidate)
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0])
  }

  const submit = async () => {
    if (!file) return
    setBusy(true)
    setNotice(null)
    try {
      const updated = await submitAssignment(assignment.assignment_id, file, note.trim())
      setFile(null)
      setNotice({ tone: 'success', text: replacing ? 'Your submission was replaced.' : 'Your work was submitted.' })
      onSubmitted(updated)
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4" aria-busy={busy}>
      {/* The drop zone is the file input's <label>: one native, keyboard-operable control. */}
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
          dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface-alt/50 hover:bg-surface-alt',
        )}
      >
        <FileUp className="size-6 text-accent-text" aria-hidden="true" />
        <span className="font-medium text-ink">
          {file ? file.name : replacing ? 'Choose a new file to replace your submission' : 'Choose a file or drop it here'}
        </span>
        <span className="text-sm text-muted">
          {file ? formatBytes(file.size) : `${ALLOWED_LABEL} · up to ${MAX_UPLOAD_MB} MB`}
        </span>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          disabled={busy}
          aria-invalid={fileError ? true : undefined}
          aria-describedby={fileError ? errorId : undefined}
          className="sr-only"
          onChange={(event) => {
            choose(event.target.files?.[0])
            event.target.value = '' // lets the same file be chosen again after a rejection
          }}
        />
      </label>
      {fileError && (
        <p id={errorId} className="text-sm text-danger-ink">
          {fileError}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-sm font-medium text-ink">
          Note for your teacher (optional)
        </label>
        <Textarea
          id={noteId}
          value={note}
          maxLength={500}
          className="min-h-20"
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
        />
        <span className="text-xs text-muted">{note.length} / 500</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={submit} disabled={!file || busy}>
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {busy ? 'Uploading…' : replacing ? 'Replace submission' : 'Submit'}
        </Button>
        {!file && !busy && <span className="text-sm text-muted">Choose a file first.</span>}
      </div>

      <StatusMessage notice={notice} />
    </div>
  )
}
