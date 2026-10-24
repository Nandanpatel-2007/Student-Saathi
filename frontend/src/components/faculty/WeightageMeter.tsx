import { cn } from '../../lib/cn'
import { formatNumber } from '../../lib/format'

/** How much of the 100% weightage budget the class's assessments use. */
export function WeightageMeter({ used }: { used: number }) {
  const over = used > 100
  const remaining = Math.max(0, 100 - used)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-ink">Weightage used</span>
        <span className={cn('tabular-nums', over ? 'text-danger-ink' : 'text-muted')}>
          {formatNumber(used, 2)}% of 100%
          {!over && ` · ${formatNumber(remaining, 2)}% left`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Weightage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(used))}
        aria-valuetext={`${formatNumber(used, 2)} percent of 100 percent used`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-alt"
      >
        <div
          className={cn('h-full rounded-full', over ? 'bg-danger-ink' : 'bg-accent')}
          style={{ width: `${Math.min(100, used)}%` }}
        />
      </div>
    </div>
  )
}
