import { startTransition, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from './useAuth'

/**
 * Log out and go to "/". Both updates run in one transition so the protected page never
 * re-renders as "anonymous" and bounces to /login before reaching the landing page.
 */
export function useLogout(): () => void {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return useCallback(() => {
    startTransition(() => {
      navigate('/', { replace: true })
      logout()
    })
  }, [navigate, logout])
}
