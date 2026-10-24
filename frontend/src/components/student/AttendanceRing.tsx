import { cn } from '../../lib/cn'
import { formatPercent } from '../../lib/format'
import type { Tone } from '../../lib/student-derive'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const toneStroke: Record<Tone, string> = {
  accent: 'stroke-accent',
  warning: 'stroke-warn-bar',
  danger: 'stroke-danger-ink',
}

interface Props {
  /** null = nothing to show yet. */
  percent: number | null
  label: string
  /** Shown instead of a percentage when `percent` is null. */
  emptyText?: string
  tone?: Tone
  className?: string
}

/** Circular attendance gauge. The figure is also announced as text. */
export function AttendanceRing({ percent, label, emptyText = 'No classes yet', tone = 'accent', className }: Props) {
  const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent))
  return (
    <div
      role="img"
      aria-label={percent === null ? `${label}: ${emptyText}` : `${label}: ${formatPercent(percent)}`}
      className={cn('relative size-40', className)}
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" className="stroke-line" />
        {percent !== null && (
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={toneStroke[tone]}
            strokeDasharray={`${(clamped / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          />
        )}
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {percent === null ? (
          <span className="px-6 text-sm text-muted">{emptyText}</span>
        ) : (
          <>
            <span className="font-display text-3xl font-semibold text-ink tabular-nums">{formatPercent(percent)}</span>
            <span className="text-xs text-muted">{label}</span>
          </>
        )}
      </div>
    </div>
  )
}
