import { useOutletContext } from 'react-router-dom'

import type { StudentDashboard } from '../lib/student-api'

/** The one dashboard payload, fetched once by StudentLayout and shared with every student page. */
export interface StudentOutletContext {
  data: StudentDashboard
  /** True while a manual refresh is running (the old data stays on screen). */
  refreshing: boolean
  reload: () => void
}

export function useStudentContext(): StudentOutletContext {
  return useOutletContext<StudentOutletContext>()
}
