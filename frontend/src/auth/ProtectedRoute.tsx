import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { FullPageLoader } from '../components/FullPageLoader'
import type { Role } from '../types/auth'
import { useAuth } from './useAuth'
import { roleHome } from './utils'

interface Props {
  allowedRoles: readonly Role[]
}

/** Layout route: renders child routes only for signed-in users with an allowed role. */
export function ProtectedRoute({ allowedRoles }: Props) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />

  if (status === 'anonymous' || !user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  if (!allowedRoles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />

  return <Outlet />
}
