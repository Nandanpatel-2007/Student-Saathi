/** "You vs the class" helpers shared by the student and faculty screens. */

export type Direction = 'above' | 'below' | 'level'

export interface Comparison {
  direction: Direction
  /** value - average, in percentage points, rounded to one decimal. */
  diff: number
}

/** Null if either side is missing. Differences that round to 0.0 count as level. */
export function compare(value: number | null | undefined, average: number | null | undefined): Comparison | null {
  if (value === null || value === undefined || average === null || average === undefined) return null
  const diff = Math.round((value - average) * 10) / 10
  return { direction: diff > 0 ? 'above' : diff < 0 ? 'below' : 'level', diff }
}

/** Compare from a difference the server already worked out (percentage points). */
export function compareDiff(diff: number | null | undefined): Comparison | null {
  if (diff === null || diff === undefined) return null
  const rounded = Math.round(diff * 10) / 10
  return { direction: rounded > 0 ? 'above' : rounded < 0 ? 'below' : 'level', diff: rounded }
}

/** "+6.2 pts", "-3.0 pts", "0 pts" (uses a real minus sign). */
export function formatDiff(comparison: Comparison | null): string {
  if (!comparison) return '—'
  if (comparison.direction === 'level') return '0 pts'
  const sign = comparison.diff > 0 ? '+' : '−'
  return `${sign}${Math.abs(comparison.diff).toFixed(1)} pts`
}

/** Full sentence for screen readers and captions: "6.2 points above the class average". */
export function describeComparison(comparison: Comparison | null): string {
  if (!comparison) return 'No data yet'
  if (comparison.direction === 'level') return 'Level with the class average'
  const points = Math.abs(comparison.diff).toFixed(1)
  return `${points} ${points === '1.0' ? 'point' : 'points'} ${comparison.direction} the class average`
}
