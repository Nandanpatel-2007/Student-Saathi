import type { StudentAssignment, SubmissionStatus } from './assignments-api'

/** Pure helpers behind the student's assignment tabs and dashboard cards. */

export type AssignmentTab = 'upcoming' | 'submitted' | 'graded' | 'overdue'

export const TAB_ORDER: readonly AssignmentTab[] = ['upcoming', 'submitted', 'graded', 'overdue']

export const TAB_LABEL: Record<AssignmentTab, string> = {
  upcoming: 'Upcoming',
  submitted: 'Submitted',
  graded: 'Graded',
  overdue: 'Overdue',
}

const TAB_OF_STATUS: Record<SubmissionStatus, AssignmentTab> = {
  NOT_SUBMITTED: 'upcoming',
  SUBMITTED: 'submitted',
  LATE: 'submitted', // late work is still submitted work; its chip says "Late"
  GRADED: 'graded',
  OVERDUE_MISSING: 'overdue',
}

export function tabOf(status: SubmissionStatus): AssignmentTab {
  return TAB_OF_STATUS[status]
}

const time = (iso: string | null) => (iso === null ? 0 : new Date(iso).getTime())

/** Items for one tab, in the order that suits it (soonest due first, most recent activity first, ...). */
export function itemsForTab(items: readonly StudentAssignment[], tab: AssignmentTab): StudentAssignment[] {
  const list = items.filter((item) => tabOf(item.status) === tab)
  switch (tab) {
    case 'upcoming':
      return list.sort((a, b) => time(a.due_at) - time(b.due_at))
    case 'submitted':
      return list.sort((a, b) => time(b.submission?.submitted_at ?? null) - time(a.submission?.submitted_at ?? null))
    case 'graded':
      return list.sort((a, b) => time(b.graded_at) - time(a.graded_at))
    case 'overdue':
      return list.sort((a, b) => time(b.due_at) - time(a.due_at))
  }
}

export function countByTab(items: readonly StudentAssignment[]): Record<AssignmentTab, number> {
  const counts: Record<AssignmentTab, number> = { upcoming: 0, submitted: 0, graded: 0, overdue: 0 }
  for (const item of items) counts[tabOf(item.status)] += 1
  return counts
}

export interface DashboardAssignments {
  dueSoon: StudentAssignment[]
  overdue: StudentAssignment[]
  recentlyGraded: StudentAssignment[]
}

/** Light summary for the dashboard: what to hand in next, what is missing, what just came back. */
export function summariseForDashboard(items: readonly StudentAssignment[], limit = 3): DashboardAssignments {
  return {
    dueSoon: itemsForTab(items, 'upcoming').slice(0, limit),
    overdue: itemsForTab(items, 'overdue'),
    recentlyGraded: itemsForTab(items, 'graded').slice(0, limit),
  }
}

/**
 * Can the student still upload (or replace) a file? Never once graded; after the deadline only if
 * late work is accepted. Mirrors the server's rules, which remain the real check.
 */
export function canSubmit(item: StudentAssignment, now: Date = new Date()): boolean {
  if (item.status === 'GRADED') return false
  return item.allow_late_submissions || now.getTime() <= new Date(item.due_at).getTime()
}

/** Why the upload form is not shown, or null when it is. */
export function submitBlockedReason(item: StudentAssignment, now: Date = new Date()): string | null {
  if (canSubmit(item, now)) return null
  if (item.status === 'GRADED') return 'This work has been graded, so it can no longer be replaced.'
  return item.submission
    ? 'The deadline has passed, so your submission can no longer be changed.'
    : 'The deadline has passed and this assignment no longer accepts submissions.'
}
