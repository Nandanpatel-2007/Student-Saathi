import { BookOpen, GraduationCap, LayoutDashboard, Layers, UserCheck } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import { PortalShell, type PortalNavItem } from '../../components/PortalShell'

const NAV: readonly PortalNavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/admin/sections', label: 'Sections', icon: Layers },
  { to: '/admin/teaching', label: 'Teaching assignments', icon: UserCheck },
  { to: '/admin/enrollments', label: 'Enrollments', icon: GraduationCap },
]

export function AdminLayout() {
  return (
    <PortalShell roleLabel="Admin" nav={NAV}>
      <Outlet />
    </PortalShell>
  )
}
