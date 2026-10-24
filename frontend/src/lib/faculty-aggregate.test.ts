import { describe, expect, it } from 'vitest'

import { aggregateSummaries } from './faculty-aggregate'
import type { ClassSummary } from './faculty-api'

const subject = { id: 1, code: 'X', name: 'X', credits: 3, semester: 3 }
const section = { id: 1, name: 'A', program: 'P', semester: 3, academic_year: '2025-2026' }
const buckets = (counts: number[]) =>
  counts.map((count, i) => ({ label: `${i * 10}-${i * 10 + 10}`, min: i * 10, max: i * 10 + 10, count }))
const risk = (id: number) => ({
  student: { id, roll_no: `R${id}`, name: `S${id}` },
  attendance_pct: 50,
  average_score_pct: 30,
  alerts: [],
})

function summary(over: Partial<ClassSummary>): ClassSummary {
  return {
    assignment_id: 1,
    subject,
    section,
    students: 0,
    sessions_held: 5,
    attendance_pct: null,
    average_score_pct: null,
    marks_distribution: buckets(new Array(10).fill(0)),
    at_risk_students: [],
    ...over,
  }
}

const a = summary({
  students: 30,
  attendance_pct: 90,
  average_score_pct: 70,
  marks_distribution: buckets([0, 0, 0, 0, 0, 0, 0, 30, 0, 0]),
  at_risk_students: [risk(1), risk(2)],
})
const b = summary({
  assignment_id: 2,
  students: 10,
  attendance_pct: 50,
  average_score_pct: 50,
  marks_distribution: buckets([0, 0, 0, 0, 0, 10, 0, 0, 0, 0]),
  at_risk_students: [risk(2), risk(3)],
})

describe('aggregateSummaries', () => {
  it('scales each class by its size', () => {
    const t = aggregateSummaries([a, b])
    expect(t.classes).toBe(2)
    expect(t.students).toBe(40)
    expect(t.attendancePct).toBe(80) // (90*30 + 50*10) / 40
    expect(t.averageScore).toBe(65) // (70*30 + 50*10) / 40
  })

  it('counts a student at risk in two classes once', () => {
    expect(aggregateSummaries([a, b]).atRiskStudents).toBe(3)
  })

  it('sums the distribution buckets in order', () => {
    const { distribution } = aggregateSummaries([a, b])
    expect(distribution).toHaveLength(10)
    expect(distribution[5]?.count).toBe(10)
    expect(distribution[7]?.count).toBe(30)
  })

  it('skips classes without data instead of treating them as zero', () => {
    const t = aggregateSummaries([a, summary({ assignment_id: 3 })])
    expect(t.attendancePct).toBe(90)
    expect(t.averageScore).toBe(70)
  })

  it('has nothing to report for no classes or one empty class', () => {
    const none = aggregateSummaries([])
    expect([none.classes, none.students, none.attendancePct, none.averageScore, none.atRiskStudents]).toEqual([
      0,
      0,
      null,
      null,
      0,
    ])
    expect(none.distribution).toEqual([])
    const empty = aggregateSummaries([summary({})])
    expect(empty.attendancePct).toBeNull()
    expect(empty.averageScore).toBeNull()
  })
})
