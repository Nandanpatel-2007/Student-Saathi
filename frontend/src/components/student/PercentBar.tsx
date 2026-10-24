import { cn } from '../../lib/cn'
import type { Tone } from '../../lib/student-derive'

const toneFill: Record<Tone | 'muted', string> = {
  accent: 'bg-accent',
  warning: 'bg-warn-bar',
  danger: 'bg-danger-ink',
  muted: 'bg-muted',
}

/** Thin horizontal bar. Decorative: always render the figure as text next to it. */
export function PercentBar({
  value,
  tone = 'accent',
  className,
}: {
  value: number | null
  tone?: Tone | 'muted'
  className?: string
}) {
  return (
    <div aria-hidden="true" className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-alt', className)}>
      {value !== null && (
        <div className={cn('h-full rounded-full', toneFill[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      )}
    </div>
  )
}
