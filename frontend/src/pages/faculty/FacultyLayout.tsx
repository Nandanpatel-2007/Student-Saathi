import { BookOpen, CalendarCheck, ClipboardCheck, FileText, LayoutDashboard, Users } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { PortalShell, type PortalNavItem } from '../../components/PortalShell'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import type { FacultyOutletContext } from '../../hooks/useFacultyContext'
import { listMyClasses } from '../../lib/faculty-api'
import { errorMessage } from '../../lib/format'

const NAV: readonly PortalNavItem[] = [
  { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/faculty/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/faculty/assessments', label: 'Assessments', icon: ClipboardCheck },
  { to: '/faculty/assignments', label: 'Assignments', icon: FileText },
  { to: '/faculty/students', label: 'Students', icon: Users },
  { to: '/faculty/subjects', label: 'Subjects', icon: BookOpen },
]

export function FacultyLayout() {
  const classes = useAsyncData('faculty-classes', listMyClasses)
  const context: FacultyOutletContext = { classes: classes.data ?? [] }

  return (
    <PortalShell roleLabel="Faculty" nav={NAV}>
      {classes.loading ? (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading your classes…</span>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : classes.error ? (
        <ErrorState message={errorMessage(classes.error)} onRetry={classes.reload} />
      ) : context.classes.length === 0 ? (
        <EmptyState
          title="No classes assigned yet"
          body="Once an admin assigns you a subject and section, your classes will appear here."
        />
      ) : (
        <Outlet context={context} />
      )}
    </PortalShell>
  )
}
