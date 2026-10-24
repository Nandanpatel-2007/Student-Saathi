import { formatDateTime } from './format'

/**
 * Human wording for submission timing. Pure functions; the rules mirror the backend's
 * apps/assignments/rules.py so the CSV export and the screens read the same.
 *
 * `offset` is seconds from the deadline to the submission: negative = before, positive = after.
 */

const DAY = 86400
const HOUR = 3600
const MINUTE = 60

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

function split(seconds: number) {
  const days = Math.floor(seconds / DAY)
  const hours = Math.floor((seconds % DAY) / HOUR)
  const minutes = Math.floor((seconds % HOUR) / MINUTE)
  return { days, hours, minutes }
}

/** "2 days before the deadline", "3 days 4 hours late", "On the deadline" (no "Submitted" prefix). */
export function timingText(offset: number): string {
  if (offset === 0) return 'On the deadline'
  const { days, hours, minutes } = split(Math.abs(offset))

  if (offset < 0) {
    // Early work: its largest unit only.
    const amount = days
      ? plural(days, 'day')
      : hours
        ? plural(hours, 'hour')
        : minutes
          ? plural(minutes, 'minute')
          : 'less than a minute'
    return `${amount} before the deadline`
  }

  // Late work: up to two units.
  const parts = days
    ? [plural(days, 'day'), ...(hours ? [plural(hours, 'hour')] : [])]
    : hours
      ? [plural(hours, 'hour'), ...(minutes ? [plural(minutes, 'minute')] : [])]
      : minutes
        ? [plural(minutes, 'minute')]
        : ['less than a minute']
  return `${parts.join(' ')} late`
}

/**
 * For a submitted piece of work: "Submitted 2 days before the deadline", "Submitted on the deadline",
 * "3 days 4 hours late". Empty string when nothing has been submitted.
 */
export function formatTiming(offset: number | null | undefined): string {
  if (offset === null || offset === undefined) return ''
  if (offset === 0) return 'Submitted on the deadline'
  if (offset < 0) return `Submitted ${timingText(offset)}`
  return timingText(offset)
}

/** "in 2 days", "in 5 hours", "overdue by 1 day", "due now" (largest unit only). */
export function relativeDue(dueAt: string | Date, now: Date = new Date()): string {
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  const seconds = Math.round((due.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < MINUTE) return 'due now'
  const { days, hours, minutes } = split(abs)
  const amount = days ? plural(days, 'day') : hours ? plural(hours, 'hour') : plural(minutes, 'minute')
  return seconds > 0 ? `in ${amount}` : `overdue by ${amount}`
}

/** "31 Oct 2026, 5:00 pm IST · in 2 days". */
export function formatDue(dueAt: string | Date, now: Date = new Date()): string {
  return `${formatDateTime(dueAt)} IST · ${relativeDue(dueAt, now)}`
}
