import type { ClassSummary, HistogramBucket } from './faculty-api'

export interface FacultyTotals {
  classes: number
  /** Sum of class sizes: a student taught in two of the faculty's classes counts twice. */
  students: number
  /** Mean of the class attendance figures, each class counted in proportion to its size; null if no data. */
  attendancePct: number | null
  /** Mean of the class average scores, counted the same way; null if no class has graded marks. */
  averageScore: number | null
  /** Distinct students flagged at risk in at least one class. */
  atRiskStudents: number
  /** Submitted assignments, across all classes, that still have no marks. */
  submissionsToGrade: number
  /** Marks distribution buckets summed across classes. */
  distribution: HistogramBucket[]
}

function sizeScaledMean(pairs: Array<{ value: number | null; weight: number }>): number | null {
  let total = 0
  let weights = 0
  for (const { value, weight } of pairs) {
    if (value === null || weight <= 0) continue
    total += value * weight
    weights += weight
  }
  return weights > 0 ? total / weights : null
}

/** Combine per-class summaries into faculty-wide figures. Pure; real numbers only. */
export function aggregateSummaries(summaries: readonly ClassSummary[]): FacultyTotals {
  const buckets = new Map<string, HistogramBucket>()
  const atRisk = new Set<number>()

  for (const summary of summaries) {
    for (const bucket of summary.marks_distribution) {
      const existing = buckets.get(bucket.label)
      buckets.set(
        bucket.label,
        existing ? { ...existing, count: existing.count + bucket.count } : { ...bucket },
      )
    }
    for (const entry of summary.at_risk_students) atRisk.add(entry.student.id)
  }

  return {
    classes: summaries.length,
    students: summaries.reduce((sum, s) => sum + s.students, 0),
    attendancePct: sizeScaledMean(summaries.map((s) => ({ value: s.attendance_pct, weight: s.students }))),
    averageScore: sizeScaledMean(summaries.map((s) => ({ value: s.average_score_pct, weight: s.students }))),
    atRiskStudents: atRisk.size,
    submissionsToGrade: summaries.reduce((sum, s) => sum + s.submissions_to_grade, 0),
    distribution: [...buckets.values()].sort((a, b) => a.min - b.min),
  }
}
