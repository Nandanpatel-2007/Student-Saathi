import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { refreshSession, setSessionExpiredHandler } from '../lib/api'
import type { AuthStatus, AuthUser, Credentials, Role } from '../types/auth'
import { fetchMe, loginRequest } from './api'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { RoleMismatchError } from './errors'
import { tokenStore } from './tokens'

interface AuthState {
  user: AuthUser | null
  status: AuthStatus
}

const ANONYMOUS: AuthState = { user: null, status: 'anonymous' }

export function AuthProvider({ children }: { children: ReactNode }) {
  // With a stored refresh token we start in "loading" and try to restore the session.
  const [state, setState] = useState<AuthState>(() =>
    tokenStore.hasRefresh() ? { user: null, status: 'loading' } : ANONYMOUS,
  )

  // A failed refresh during any protected call logs the user out.
  useEffect(() => {
    setSessionExpiredHandler(() => setState(ANONYMOUS))
    return () => setSessionExpiredHandler(null)
  }, [])

  // Restore on app start: refresh -> GET /auth/me.
  useEffect(() => {
    if (state.status !== 'loading') return
    let cancelled = false
    void (async () => {
      const outcome = await refreshSession()
      if (outcome !== 'ok') {
        // 'unreachable' keeps the stored token so a reload works once the backend is back.
        if (!cancelled) setState(ANONYMOUS)
        return
      }
      try {
        const user = await fetchMe()
        if (!cancelled) setState({ user, status: 'authenticated' })
      } catch {
        if (!cancelled) setState(ANONYMOUS)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.status])

  const login = useCallback(async (credentials: Credentials, expectedRole?: Role): Promise<AuthUser> => {
    const result = await loginRequest(credentials)
    if (expectedRole && result.user.role !== expectedRole) {
      // Wrong tab: never store the tokens, never mark the user as logged in.
      throw new RoleMismatchError(expectedRole, result.user.role)
    }
    tokenStore.setAccess(result.access)
    tokenStore.setRefresh(result.refresh)
    setState({ user: result.user, status: 'authenticated' })
    return result.user
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setState(ANONYMOUS)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user: state.user, status: state.status, login, logout }),
    [state, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
