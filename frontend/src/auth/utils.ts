import type { Role } from '../types/auth'

export const ROLE_HOME: Record<Role, string> = {
  STUDENT: '/student',
  FACULTY: '/faculty',
  ADMIN: '/admin',
}

export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: 'Student',
  FACULTY: 'Faculty',
  ADMIN: 'Admin',
}

export function roleHome(role: Role): string {
  return ROLE_HOME[role]
}

/** Which role owns a path prefix (/student/..., /faculty/..., /admin/...), if any. */
function requiredRoleFor(pathname: string): Role | null {
  for (const role of Object.keys(ROLE_HOME) as Role[]) {
    const base = ROLE_HOME[role]
    if (pathname === base || pathname.startsWith(`${base}/`)) return role
  }
  return null
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

/**
 * True only for a same-origin, absolute path: starts with exactly one "/", no backslashes,
 * no control characters (browsers strip tabs/newlines, which could turn "/\t/evil" into "//evil").
 */
export function isSafeInternalPath(value: string | null | undefined): value is string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return false
  if (value.includes('\\') || hasControlChars(value)) return false
  try {
    // Resolving against a throwaway origin must not change the origin.
    const base = 'http://app.invalid'
    return new URL(value, base).origin === base
  } catch {
    return false
  }
}

/** Can this role open this (already safe) path? Unowned paths are open to everyone signed in. */
export function canRoleAccessPath(role: Role, path: string): boolean {
  const pathname = new URL(path, 'http://app.invalid').pathname
  if (pathname === '/login') return false
  const required = requiredRoleFor(pathname)
  return required === null || required === role
}

/** Where to send a user after login: `next` if it is safe and allowed for the role, else their home. */
export function safeNextPath(next: string | null | undefined, role: Role): string {
  if (isSafeInternalPath(next) && canRoleAccessPath(role, next)) return next
  return roleHome(role)
}
