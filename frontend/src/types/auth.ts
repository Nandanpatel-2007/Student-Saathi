export const ROLES = ['STUDENT', 'FACULTY', 'ADMIN'] as const

export type Role = (typeof ROLES)[number]

export interface AuthUser {
  id: number
  name: string
  role: Role
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface Credentials {
  username: string
  password: string
}

/** One entry of the backend's error envelope `details` array. */
export interface ApiErrorDetail {
  field: string | null
  message: string
}
