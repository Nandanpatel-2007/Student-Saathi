import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form'

import { ApiError } from './api'
import { errorMessage } from './format'

interface Options<T extends FieldValues> {
  /** A 409 (duplicate) without field details is shown on this field, e.g. "code". */
  conflictField?: FieldPath<T>
}

/**
 * Put an API error next to the form field it belongs to. `details[].field` may be a dotted
 * path such as "body.payload.code"; only its last segment is matched against `fields`.
 * Returns a message for anything that could not be placed (to show above the buttons), or
 * null when everything was attached to a field.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  fields: readonly FieldPath<T>[],
  setError: UseFormSetError<T>,
  { conflictField }: Options<T> = {},
): string | null {
  if (error instanceof ApiError) {
    let placed = false
    for (const detail of error.details) {
      const name = detail.field?.split('.').pop()
      const field = fields.find((f) => f === name)
      if (field) {
        setError(field, { message: detail.message })
        placed = true
      }
    }
    if (!placed && error.status === 409 && conflictField) {
      setError(conflictField, { message: error.message })
      placed = true
    }
    if (placed) return null
  }
  return errorMessage(error)
}
