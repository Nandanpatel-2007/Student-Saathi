import { describe, expect, it } from 'vitest'

import {
  formatDate,
  formatDateTime,
  formatLongDate,
  formatNumber,
  formatPercent,
  istHour,
  istInputToIso,
  toIstInputValue,
  todayISO,
} from './format'

describe('numbers', () => {
  it('formats percentages and numbers, with a dash for missing values', () => {
    expect(formatPercent(82.456)).toBe('82.5%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(null)).toBe('—')
    expect(formatNumber(2.5)).toBe('2.5')
    expect(formatNumber(undefined)).toBe('—')
  })
})

describe('IST handling', () => {
  it('shows instants in Asia/Kolkata whatever the machine zone is', () => {
    expect(formatDateTime('2026-10-31T11:30:00Z')).toBe('31 Oct 2026, 5:00 pm')
    expect(formatDateTime('2026-10-31T18:29:00Z')).toBe('31 Oct 2026, 11:59 pm')
    expect(formatDateTime('2026-10-31T18:30:00Z')).toBe('1 Nov 2026, 12:00 am') // crosses midnight in IST
  })

  it('works out today in IST, not UTC', () => {
    expect(todayISO(new Date('2026-10-24T18:00:00Z'))).toBe('2026-10-24') // 23:30 IST
    expect(todayISO(new Date('2026-10-24T18:30:00Z'))).toBe('2026-10-25') // 00:00 IST next day
  })

  it('round-trips a datetime-local value as IST', () => {
    const iso = istInputToIso('2026-10-31T17:00')
    expect(iso).toBe('2026-10-31T11:30:00.000Z')
    expect(toIstInputValue(iso as string)).toBe('2026-10-31T17:00')
    expect(toIstInputValue('2026-10-31T18:30:00Z')).toBe('2026-11-01T00:00')
  })

  it('rejects values that are not a date-time', () => {
    expect(istInputToIso('')).toBeNull()
    expect(istInputToIso('2026-10-31')).toBeNull()
    expect(istInputToIso('2026-13-45T25:61')).toBeNull()
  })

  it('formats the long date and the hour in IST', () => {
    expect(formatLongDate(new Date('2026-10-24T18:00:00Z'))).toBe('Saturday, 24 October 2026')
    expect(formatLongDate(new Date('2026-10-24T18:30:00Z'))).toBe('Sunday, 25 October 2026')
    expect(istHour(new Date('2026-10-24T18:30:00Z'))).toBe(0)
    expect(istHour(new Date('2026-10-24T11:30:00Z'))).toBe(17)
  })

  it('formats calendar dates without shifting the day', () => {
    expect(formatDate('2026-01-05')).toBe('5 Jan 2026')
  })
})
