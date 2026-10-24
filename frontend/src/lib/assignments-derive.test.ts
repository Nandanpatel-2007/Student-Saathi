import { describe, expect, it } from 'vitest'

import type { StudentAssignment } from './assignments-api'
import {
  canSubmit,
  countByTab,
  itemsForTab,
  submitBlockedReason,
  summariseForDashboard,
  tabOf,
} from './assignments-derive'

const NOW = new Date('2026-10-24T10:00:00Z')
const at = (hours: number) => new Date(NOW.getTime() + hours * 3600_000).toISOString()

let counter = 0
function item(over: Partial<StudentAssignment> = {}): StudentAssignment {
  counter += 1
  return {
    assignment_id: counter,
    teaching_assignment_id: 1,
    title: `Work ${counter}`,
    description: '',
    subject: { id: 1, code: 'CS301', name: 'Algorithms', credits: 4, semester: 3 },
    section: { id: 1, name: 'A', program: 'B.Tech', semester: 3, academic_year: '2025-2026' },
    due_at: at(24),
    max_marks: 20,
    allow_late_submissions: true,
    status: 'NOT_SUBMITTED',
    timing: null,
    offset_seconds: null,
    submission: null,
    marks_obtained: null,
    feedback: '',
    graded_at: null,
    ...over,
  }
}

const submission = (hoursFromNow: number) => ({
  original_name: 'w.pdf',
  size: 10,
  note: '',
  submitted_at: at(hoursFromNow),
})

describe('tabs', () => {
  it('maps each status to a tab', () => {
    expect(tabOf('NOT_SUBMITTED')).toBe('upcoming')
    expect(tabOf('SUBMITTED')).toBe('submitted')
    expect(tabOf('LATE')).toBe('submitted')
    expect(tabOf('GRADED')).toBe('graded')
    expect(tabOf('OVERDUE_MISSING')).toBe('overdue')
  })

  it('counts items per tab', () => {
    const items = [item(), item(), item({ status: 'LATE' }), item({ status: 'GRADED' }), item({ status: 'OVERDUE_MISSING' })]
    expect(countByTab(items)).toEqual({ upcoming: 2, submitted: 1, graded: 1, overdue: 1 })
    expect(countByTab([])).toEqual({ upcoming: 0, submitted: 0, graded: 0, overdue: 0 })
  })

  it('orders each tab sensibly', () => {
    const later = item({ title: 'later', due_at: at(72) })
    const sooner = item({ title: 'sooner', due_at: at(5) })
    expect(itemsForTab([later, sooner], 'upcoming').map((i) => i.title)).toEqual(['sooner', 'later'])

    const old = item({ title: 'old', status: 'SUBMITTED', submission: submission(-50) })
    const fresh = item({ title: 'fresh', status: 'LATE', submission: submission(-2) })
    expect(itemsForTab([old, fresh], 'submitted').map((i) => i.title)).toEqual(['fresh', 'old'])

    const g1 = item({ title: 'g1', status: 'GRADED', graded_at: at(-40) })
    const g2 = item({ title: 'g2', status: 'GRADED', graded_at: at(-4) })
    expect(itemsForTab([g1, g2], 'graded').map((i) => i.title)).toEqual(['g2', 'g1'])

    const o1 = item({ title: 'o1', status: 'OVERDUE_MISSING', due_at: at(-100) })
    const o2 = item({ title: 'o2', status: 'OVERDUE_MISSING', due_at: at(-10) })
    expect(itemsForTab([o1, o2], 'overdue').map((i) => i.title)).toEqual(['o2', 'o1'])
  })

  it('does not mutate its input', () => {
    const items = [item({ due_at: at(9) }), item({ due_at: at(1) })]
    const before = items.map((i) => i.assignment_id)
    itemsForTab(items, 'upcoming')
    expect(items.map((i) => i.assignment_id)).toEqual(before)
  })
})

describe('summariseForDashboard', () => {
  it('limits due-soon and recently-graded, but reports every overdue item', () => {
    const items = [
      ...[1, 2, 3, 4, 5].map((n) => item({ due_at: at(n * 10) })),
      ...[1, 2, 3, 4].map((n) => item({ status: 'GRADED', graded_at: at(-n) })),
      item({ status: 'OVERDUE_MISSING' }),
      item({ status: 'OVERDUE_MISSING' }),
    ]
    const summary = summariseForDashboard(items)
    expect(summary.dueSoon).toHaveLength(3)
    expect(summary.recentlyGraded).toHaveLength(3)
    expect(summary.overdue).toHaveLength(2)
    expect(summary.recentlyGraded[0]?.graded_at).toBe(at(-1))
  })

  it('is empty for a student with nothing', () => {
    expect(summariseForDashboard([])).toEqual({ dueSoon: [], overdue: [], recentlyGraded: [] })
  })
})

describe('canSubmit / submitBlockedReason', () => {
  it('allows work before the deadline and, when late work is accepted, after it', () => {
    expect(canSubmit(item({ due_at: at(2) }), NOW)).toBe(true)
    expect(canSubmit(item({ due_at: at(-2), allow_late_submissions: true, status: 'OVERDUE_MISSING' }), NOW)).toBe(true)
    expect(canSubmit(item({ due_at: at(-2), status: 'LATE', submission: submission(-1) }), NOW)).toBe(true)
  })

  it('refuses after the deadline when late work is not accepted', () => {
    const closed = item({ due_at: at(-1), allow_late_submissions: false, status: 'OVERDUE_MISSING' })
    expect(canSubmit(closed, NOW)).toBe(false)
    expect(submitBlockedReason(closed, NOW)).toMatch(/no longer accepts submissions/)
    const submittedClosed = item({ due_at: at(-1), allow_late_submissions: false, status: 'SUBMITTED', submission: submission(-5) })
    expect(submitBlockedReason(submittedClosed, NOW)).toMatch(/can no longer be changed/)
  })

  it('refuses once graded, even before the deadline', () => {
    const graded = item({ status: 'GRADED', due_at: at(48), submission: submission(-5), marks_obtained: 10 })
    expect(canSubmit(graded, NOW)).toBe(false)
    expect(submitBlockedReason(graded, NOW)).toMatch(/graded/)
    expect(submitBlockedReason(item({ due_at: at(2) }), NOW)).toBeNull()
  })

  it('treats the deadline instant itself as still open', () => {
    expect(canSubmit(item({ due_at: NOW.toISOString(), allow_late_submissions: false }), NOW)).toBe(true)
  })
})
