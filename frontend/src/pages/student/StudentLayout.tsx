import { Bell, CalendarDays, FileText, LayoutDashboard, TrendingUp } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { PortalShell, type PortalNavItem } from '../../components/PortalShell'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import type { StudentOutletContext } from '../../hooks/useStudentContext'
import { errorMessage } from '../../lib/format'
import { fetchStudentDashboard } from '../../lib/student-api'

const NAV: readonly PortalNavItem[] = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/attendance', label: 'My attendance', icon: CalendarDays },
  { to: '/student/performance', label: 'Performance', icon: TrendingUp },
  { to: '/student/assignments', label: 'Assignments', icon: FileText },
  { to: '/student/alerts', label: 'Alerts', icon: Bell },
]

export function StudentLayout() {
  const dashboard = useAsyncData('student-dashboard', fetchStudentDashboard)
  const { data } = dashboard

  return (
    <PortalShell roleLabel="Student" nav={NAV}>
      {dashboard.error && !data ? (
        <ErrorState message={errorMessage(dashboard.error)} onRetry={dashboard.reload} />
      ) : !data ? (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading your dashboard…</span>
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64 lg:col-span-2" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : data.subjects.length === 0 ? (
        <EmptyState
          title="Nothing to show yet"
          body="You are not enrolled in any subject yet. Once you are, and classes begin, your attendance and scores will appear here."
        />
      ) : (
        <Outlet context={{ data, refreshing: dashboard.refreshing, reload: dashboard.reload } satisfies StudentOutletContext} />
      )}
    </PortalShell>
  )
}
