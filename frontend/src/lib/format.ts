import { ApiError } from './api'

/** The one time zone the whole product speaks. The backend's TIME_ZONE is the same. */
export const APP_TIME_ZONE = 'Asia/Kolkata'
/** IST has no daylight saving, so a fixed offset is safe for turning form input into an instant. */
const IST_OFFSET = '+05:30'

/** 82.456 -> "82.5%", null -> "—". */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? '—' : `${Number(value.toFixed(digits))}%`
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? '—' : String(Number(value.toFixed(digits)))
}

/** "2025-09-28" -> "28 Sep 2025" (a calendar date, parsed locally, so no time zone shift). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const dateTimeFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: APP_TIME_ZONE,
})

/** An instant shown in IST: "31 Oct 2026, 5:00 pm". */
export function formatDateTime(iso: string | Date): string {
  return dateTimeFormat.format(typeof iso === 'string' ? new Date(iso) : iso)
}

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function istParts(date: Date): Record<string, string> {
  const parts: Record<string, string> = {}
  for (const part of partsFormat.formatToParts(date)) parts[part.type] = part.value
  return parts
}

/** Today's date in IST as YYYY-MM-DD (matches the backend's notion of "today"). */
export function todayISO(now: Date = new Date()): string {
  const p = istParts(now)
  return `${p.year}-${p.month}-${p.day}`
}

/** An instant as the value of an <input type="datetime-local">, read in IST: "2026-10-31T17:00". */
export function toIstInputValue(iso: string | Date): string {
  const p = istParts(typeof iso === 'string' ? new Date(iso) : iso)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** The value of a datetime-local input, read as IST, as a UTC ISO string. null if it is not a date-time. */
export function istInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const instant = new Date(`${value}:00${IST_OFFSET}`)
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString()
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const longDateFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: APP_TIME_ZONE,
})

/** "Saturday, 24 October 2026" in IST. */
export function formatLongDate(now: Date = new Date()): string {
  return longDateFormat.format(now)
}

/** The hour of day (0-23) in IST. */
export function istHour(now: Date = new Date()): number {
  return Number(istParts(now).hour)
}
