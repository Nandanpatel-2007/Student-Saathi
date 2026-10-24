import { useEffect, useEffectEvent, useState } from 'react'

export interface AsyncData<T> {
  /** Latest successful result for this key; kept while the same key reloads. */
  data: T | undefined
  /** True until the first result (or error) for the current key arrives. */
  loading: boolean
  /** True while a reload of already-shown data is in flight. */
  refreshing: boolean
  error: unknown
  reload: () => void
}

interface Settled<T> {
  fullKey: string
  baseKey: string
  data?: T
  error?: unknown
}

/**
 * Load data keyed by a string. Changing `key` refetches; `null` disables the request.
 * Stale responses from an earlier key are ignored.
 */
export function useAsyncData<T>(key: string | null, fetcher: () => Promise<T>): AsyncData<T> {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const fullKey = key === null ? null : `${key}#${attempt}`
  const load = useEffectEvent(fetcher)

  useEffect(() => {
    if (fullKey === null || key === null) return
    let cancelled = false
    load().then(
      (data) => {
        if (!cancelled) setSettled({ fullKey, baseKey: key, data })
      },
      (error: unknown) => {
        if (!cancelled) setSettled({ fullKey, baseKey: key, error })
      },
    )
    return () => {
      cancelled = true
    }
  }, [fullKey, key])

  const isCurrent = settled !== null && settled.fullKey === fullKey
  const sameBase = settled !== null && settled.baseKey === key
  const data = key !== null && sameBase ? settled.data : undefined

  return {
    data,
    loading: key !== null && !isCurrent && data === undefined,
    refreshing: key !== null && !isCurrent && data !== undefined,
    error: isCurrent ? settled.error : undefined,
    reload: () => setAttempt((n) => n + 1),
  }
}
