import { ROLE_LABEL } from './utils'
import type { Role } from '../types/auth'

/** The credentials were valid but belong to a different role than the selected tab. */
export class RoleMismatchError extends Error {
  readonly expected: Role
  readonly actual: Role

  constructor(expected: Role, actual: Role) {
    super(`This account is not a ${ROLE_LABEL[expected]} account.`)
    this.name = 'RoleMismatchError'
    this.expected = expected
    this.actual = actual
  }
}
