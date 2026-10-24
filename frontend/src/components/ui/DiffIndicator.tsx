import { ArrowDown, ArrowUp, Equal } from 'lucide-react'

import { cn } from '../../lib/cn'
import { describeComparison, formatDiff, type Comparison } from '../../lib/compare'

interface Props {
  comparison: Comparison | null
  /** Show the full sentence ("6.2 points above the class average") instead of "+6.2 pts". */
  verbose?: boolean
  className?: string
}

/** Above / below / level indicator: an icon plus text, so it never relies on colour alone. */
export function DiffIndicator({ comparison, verbose = false, className }: Props) {
  if (!comparison)
    return (
      <span className={cn('text-muted', className)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No data yet</span>
      </span>
    )

  const Icon = comparison.direction === 'above' ? ArrowUp : comparison.direction === 'below' ? ArrowDown : Equal
  const tone =
    comparison.direction === 'above'
      ? 'text-accent-text'
      : comparison.direction === 'below'
        ? 'text-warn-ink'
        : 'text-muted'

  return (
    <span className={cn('inline-flex items-center gap-1 font-medium whitespace-nowrap', tone, className)}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {verbose ? (
        describeComparison(comparison)
      ) : (
        <>
          <span aria-hidden="true">{formatDiff(comparison)}</span>
          <span className="sr-only">{describeComparison(comparison)}</span>
        </>
      )}
    </span>
  )
}
