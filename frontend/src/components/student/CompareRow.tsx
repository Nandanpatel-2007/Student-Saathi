import { compare } from '../../lib/compare'
import { formatPercent } from '../../lib/format'
import type { Tone } from '../../lib/student-derive'
import { DiffIndicator } from '../ui/DiffIndicator'
import { PercentBar } from './PercentBar'

interface Props {
  label: string
  you: number | null
  classAvg: number | null
  /** Colour of "your" bar, from the API's alert severity for this measure. */
  tone?: Tone
  /** Extra detail shown when there is no figure yet (e.g. "No classes yet"). */
  emptyNote?: string
}

/** "You: 82% | Class avg: 76%" with an above/below indicator and a pair of bars. */
export function CompareRow({ label, you, classAvg, tone = 'accent', emptyNote }: Props) {
  const comparison = compare(you, classAvg)
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm text-muted">{label}</span>
        <DiffIndicator comparison={comparison} className="text-sm" />
      </div>

      {you === null ? (
        <p className="mt-1 text-sm text-ink">
          No data yet
          {emptyNote && <span className="text-muted"> · {emptyNote}</span>}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink tabular-nums">
            <span className="font-semibold">You: {formatPercent(you)}</span>
            <span className="text-muted"> | </span>
            <span>Class avg: {classAvg === null ? 'No data yet' : formatPercent(classAvg)}</span>
          </p>
          <div className="mt-2 space-y-1">
            <PercentBar value={you} tone={tone} />
            <PercentBar value={classAvg} tone="muted" className="h-1.5" />
          </div>
        </>
      )}
    </div>
  )
}
