import { useOutletContext } from 'react-router-dom'

import type { FacultyClass } from '../lib/faculty-api'

/** Shared by FacultyLayout with every faculty page through <Outlet context>. */
export interface FacultyOutletContext {
  classes: FacultyClass[]
}

export function useFacultyContext(): FacultyOutletContext {
  return useOutletContext<FacultyOutletContext>()
}
