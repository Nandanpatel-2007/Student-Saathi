import { describe, expect, it } from 'vitest'

import { formatDue, formatTiming, relativeDue, timingText } from './timing'

const DAY = 86400
const HOUR = 3600
const MIN = 60

describe('formatTiming', () => {
  it('words early work with its largest unit', () => {
    expect(formatTiming(-2 * DAY)).toBe('Submitted 2 days before the deadline')
    expect(formatTiming(-(2 * DAY + 5 * HOUR))).toBe('Submitted 2 days before the deadline')
    expect(formatTiming(-DAY)).toBe('Submitted 1 day before the deadline')
    expect(formatTiming(-5 * HOUR)).toBe('Submitted 5 hours before the deadline')
    expect(formatTiming(-HOUR)).toBe('Submitted 1 hour before the deadline')
    expect(formatTiming(-12 * MIN)).toBe('Submitted 12 minutes before the deadline')
    expect(formatTiming(-30)).toBe('Submitted less than a minute before the deadline')
  })

  it('words late work with up to two units', () => {
    expect(formatTiming(3 * DAY + 4 * HOUR)).toBe('3 days 4 hours late')
    expect(formatTiming(3 * DAY)).toBe('3 days late')
    expect(formatTiming(DAY + 59 * MIN)).toBe('1 day late')
    expect(formatTiming(5 * HOUR + 20 * MIN)).toBe('5 hours 20 minutes late')
    expect(formatTiming(2 * HOUR)).toBe('2 hours late')
    expect(formatTiming(12 * MIN)).toBe('12 minutes late')
    expect(formatTiming(1)).toBe('less than a minute late')
  })

  it('handles the deadline itself and missing submissions', () => {
    expect(formatTiming(0)).toBe('Submitted on the deadline')
    expect(formatTiming(null)).toBe('')
    expect(formatTiming(undefined)).toBe('')
  })
})

describe('timingText matches the backend wording', () => {
  it.each([
    [0, 'On the deadline'],
    [-2 * DAY, '2 days before the deadline'],
    [3 * DAY + 4 * HOUR, '3 days 4 hours late'],
    [-30, 'less than a minute before the deadline'],
    [1, 'less than a minute late'],
  ])('%i seconds', (offset, text) => {
    expect(timingText(offset)).toBe(text)
  })
})

describe('relativeDue', () => {
  const now = new Date('2026-10-24T10:00:00Z')
  const at = (seconds: number) => new Date(now.getTime() + seconds * 1000)

  it('looks ahead and back with the largest unit', () => {
    expect(relativeDue(at(2 * DAY + 3 * HOUR), now)).toBe('in 2 days')
    expect(relativeDue(at(5 * HOUR), now)).toBe('in 5 hours')
    expect(relativeDue(at(90), now)).toBe('in 1 minute')
    expect(relativeDue(at(-DAY), now)).toBe('overdue by 1 day')
    expect(relativeDue(at(-3 * HOUR), now)).toBe('overdue by 3 hours')
    expect(relativeDue(at(-10 * MIN), now)).toBe('overdue by 10 minutes')
  })

  it('says "due now" within a minute either way', () => {
    expect(relativeDue(at(30), now)).toBe('due now')
    expect(relativeDue(at(-30), now)).toBe('due now')
    expect(relativeDue(at(0), now)).toBe('due now')
  })

  it('accepts an ISO string', () => {
    expect(relativeDue('2026-10-26T10:00:00Z', now)).toBe('in 2 days')
  })
})

describe('formatDue', () => {
  it('shows the exact IST time and the relative hint', () => {
    const now = new Date('2026-10-29T10:00:00Z')
    // 11:30 UTC = 17:00 IST
    expect(formatDue('2026-10-31T11:30:00Z', now)).toBe('31 Oct 2026, 5:00 pm IST · in 2 days')
  })
})
