import type { ReactNode } from 'react'

import { Button } from './Button'
import { Modal } from './Modal'
import { StatusMessage } from './StatusMessage'

interface Props {
  open: boolean
  title: string
  /** Explain what will happen, including what the server may refuse. */
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  /** An error from the last attempt (for example "Subject is in use…"). */
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, children, confirmLabel, busy, error, onConfirm, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} dismissible={!busy}>
      <div className="space-y-4 p-5">
        <div className="text-sm text-muted">{children}</div>
        <StatusMessage notice={error ? { tone: 'error', text: error } : null} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
