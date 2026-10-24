import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { FacultyClass } from '../lib/faculty-api'
import { useFacultyContext } from './useFacultyContext'

export const ALL_CLASSES = 'all'

/**
 * The class chosen in the page's picker, kept in the URL as `?class=<assignment_id>` so it
 * survives refresh and can be linked to. With `allowAll`, no/`all` means every class (selected = null);
 * otherwise it falls back to the first class.
 */
export function useSelectedClass({ allowAll }: { allowAll: boolean }) {
  const { classes } = useFacultyContext()
  const [params, setParams] = useSearchParams()
  const raw = params.get('class')

  const match = classes.find((c) => String(c.assignment_id) === raw)
  const selected: FacultyClass | null = match ?? (allowAll ? null : (classes[0] ?? null))
  const value = selected ? String(selected.assignment_id) : ALL_CLASSES

  const setClass = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev)
          copy.set('class', next)
          copy.delete('assessment') // an assessment belongs to one class
          return copy
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { classes, selected, value, setClass }
}
