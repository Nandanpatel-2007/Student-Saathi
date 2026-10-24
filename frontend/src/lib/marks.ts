/** Pure helpers for the marks sheet. */

export interface MarkRowInput {
  value: string
  absent: boolean
}

/** Returns an error message, or null when the entry is acceptable (blank = not graded). */
export function validateMark(value: string, absent: boolean, maxMarks: number): string | null {
  if (absent) return null
  const text = value.trim()
  if (text === '') return null
  const num = Number(text)
  if (!Number.isFinite(num)) return 'Enter a number'
  if (num < 0) return 'Cannot be negative'
  if (num > maxMarks) return `Cannot exceed ${maxMarks}`
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'Use at most 2 decimal places'
  return null
}

export interface MarkStats {
  total: number
  graded: number
  absent: number
  /** Average of entered marks (absences and blanks excluded); null if none entered. */
  average: number | null
  averagePercent: number | null
  high: number | null
  low: number | null
  /** Share of rows that are graded or marked absent, 0-100. */
  completion: number
}

export function computeMarkStats(rows: readonly MarkRowInput[], maxMarks: number): MarkStats {
  const entered: number[] = []
  let absent = 0
  for (const row of rows) {
    if (row.absent) {
      absent += 1
      continue
    }
    if (validateMark(row.value, false, maxMarks) !== null || row.value.trim() === '') continue
    entered.push(Number(row.value))
  }
  const average = entered.length ? entered.reduce((a, b) => a + b, 0) / entered.length : null
  return {
    total: rows.length,
    graded: entered.length,
    absent,
    average,
    averagePercent: average !== null && maxMarks > 0 ? (average / maxMarks) * 100 : null,
    high: entered.length ? Math.max(...entered) : null,
    low: entered.length ? Math.min(...entered) : null,
    completion: rows.length ? ((entered.length + absent) / rows.length) * 100 : 0,
  }
}

