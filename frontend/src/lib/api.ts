import { z } from 'zod'

import { tokenStore } from '../auth/tokens'
import type { ApiErrorDetail } from '../types/auth'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(
  /\/+$/,
  '',
)

// ---------------------------------------------------------------- errors

/** The backend's standard envelope for every non-2xx response. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorDetail[]

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const errorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z
      .array(z.object({ field: z.string().nullable().optional(), message: z.string() }))
      .optional(),
  }),
})

async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = undefined
  }
  const parsed = errorEnvelope.safeParse(body)
  if (parsed.success) {
    const { code, message, details } = parsed.data.error
    return new ApiError(
      res.status,
      code,
      message,
      (details ?? []).map((d) => ({ field: d.field ?? null, message: d.message })),
    )
  }
  return new ApiError(
    res.status,
    'http_error',
    res.status >= 500 ? 'Something went wrong on the server. Please try again.' : `Request failed (${res.status}).`,
  )
}

// ---------------------------------------------------------------- session hooks

let onSessionExpired: (() => void) | null = null

/** AuthProvider registers here so a failed refresh can drop the React state too. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler
}

function expireSession(): void {
  tokenStore.clear()
  onSessionExpired?.()
}

// ---------------------------------------------------------------- transport

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: Method
  body?: unknown
  /** Attach the bearer token and refresh-and-retry once on 401. Default false. */
  auth?: boolean
}

async function send(path: string, method: Method, body: unknown, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Can’t reach the server. Check your connection and that the backend is running.')
  }
}

const refreshResponse = z.object({ access: z.string(), refresh: z.string().optional() })

export type RefreshOutcome = 'ok' | 'rejected' | 'unreachable'

let refreshInFlight: Promise<RefreshOutcome> | null = null

async function doRefresh(): Promise<RefreshOutcome> {
  const refresh = tokenStore.getRefresh()
  if (!refresh) return 'rejected'

  let res: Response
  try {
    res = await send('/auth/refresh', 'POST', { refresh }, null)
  } catch {
    return 'unreachable'
  }
  if (res.status >= 500) return 'unreachable'
  if (!res.ok) {
    tokenStore.clear()
    return 'rejected'
  }
  const parsed = refreshResponse.safeParse(await res.json().catch(() => undefined))
  if (!parsed.success) return 'unreachable'
  tokenStore.setAccess(parsed.data.access)
  // The backend normally omits `refresh`; keep the stored one unless it rotates.
  if (parsed.data.refresh) tokenStore.setRefresh(parsed.data.refresh)
  return 'ok'
}

/** Exchange the stored refresh token for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<RefreshOutcome> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function parseBody<S extends z.ZodType>(res: Response, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await res.json().catch(() => undefined))
  if (!parsed.success) {
    throw new ApiError(res.status, 'invalid_response', 'The server sent an unexpected response.')
  }
  return parsed.data
}

/**
 * Typed JSON request. The response body is validated against `schema`.
 * Protected calls (`auth: true`) get one refresh + one retry on a 401, then the user is logged out.
 */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  { method = 'GET', body, auth = false }: RequestOptions = {},
): Promise<z.infer<S>> {
  let res = await send(path, method, body, auth ? tokenStore.getAccess() : null)

  if (res.status === 401 && auth) {
    const outcome = await refreshSession()
    if (outcome === 'ok') res = await send(path, method, body, tokenStore.getAccess())
    if (outcome !== 'ok' || res.status === 401) {
      expireSession()
      throw await toApiError(res)
    }
  }

  if (!res.ok) throw await toApiError(res)
  return parseBody(res, schema)
}
