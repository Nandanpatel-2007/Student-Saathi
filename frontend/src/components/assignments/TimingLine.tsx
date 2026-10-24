import { cn } from '../../lib/cn'
import { formatDateTime } from '../../lib/format'
import { formatTiming } from '../../lib/timing'

interface Props {
  offsetSeconds: number | null
  submittedAt: string | null
  /** Also print the exact IST timestamp under the wording. */
  showExact?: boolean
  className?: string
}

/** "Submitted 2 days before the deadline" / "3 days 4 hours late", with the exact time as secondary text. */
export function TimingLine({ offsetSeconds, submittedAt, showExact = true, className }: Props) {
  if (offsetSeconds === null || submittedAt === null) return null
  const exact = `${formatDateTime(submittedAt)} IST`
  const late = offsetSeconds > 0
  return (
    <span className={cn('block', className)} title={exact}>
      <span className={cn('font-medium', late ? 'text-warn-ink' : 'text-ink')}>{formatTiming(offsetSeconds)}</span>
      {showExact && <span className="block text-xs text-muted">{exact}</span>}
    </span>
  )
}
