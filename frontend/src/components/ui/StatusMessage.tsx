import { cn } from '../../lib/cn'

export interface Notice {
  tone: 'success' | 'error' | 'info'
  text: string
}

const tones: Record<Notice['tone'], string> = {
  success: 'border-line bg-accent-soft text-accent-text',
  info: 'border-line bg-surface-alt text-ink',
  error: 'border-danger-line bg-danger-bg text-danger-ink',
}

interface Props {
  notice: Notice | null
  className?: string
  /** Add vertical breathing room around the message (only when one is showing). */
  spaced?: boolean
}

/** Always-mounted live region so screen readers announce messages as they appear. */
export function StatusMessage({ notice, className, spaced }: Props) {
  return (
    <div role="status" aria-live="polite" className={className}>
      {notice && (
        <p className={cn('rounded-lg border px-3 py-2.5 text-sm', tones[notice.tone], spaced && 'my-4')}>
          {notice.text}
        </p>
      )}
    </div>
  )
}
