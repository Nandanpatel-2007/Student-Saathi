import { z } from 'zod'

import { apiRequest } from '../lib/api'
import { ROLES, type AuthUser, type Credentials } from '../types/auth'

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  role: z.enum(ROLES),
})

const loginSchema = z.object({
  access: z.string(),
  refresh: z.string(),
  user: userSchema,
})

export interface LoginResult {
  access: string
  refresh: string
  user: AuthUser
}

/** The login request carries only username and password. The backend decides the role. */
export function loginRequest({ username, password }: Credentials): Promise<LoginResult> {
  return apiRequest('/auth/login', loginSchema, { method: 'POST', body: { username, password } })
}

export function fetchMe(): Promise<AuthUser> {
  return apiRequest('/auth/me', userSchema, { auth: true })
}
