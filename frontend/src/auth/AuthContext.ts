import { createContext } from 'react'

import type { AuthStatus, AuthUser, Credentials, Role } from '../types/auth'

export interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  /**
   * Sign in. When `expectedRole` is given and the account has a different role, nothing is
   * stored and a RoleMismatchError is thrown. API failures throw ApiError.
   */
  login: (credentials: Credentials, expectedRole?: Role) => Promise<AuthUser>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
