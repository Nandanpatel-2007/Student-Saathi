import { describe, expect, it } from 'vitest'

import { computeMarkStats, validateMark } from './marks'

describe('validateMark', () => {
  it('accepts blank (not graded) and values up to the maximum', () => {
    expect(validateMark('', false, 20)).toBeNull()
    expect(validateMark('0', false, 20)).toBeNull()
    expect(validateMark('20', false, 20)).toBeNull()
    expect(validateMark('17.25', false, 20)).toBeNull()
  })

  it('rejects out-of-range and malformed input', () => {
    expect(validateMark('20.01', false, 20)).toBe('Cannot exceed 20')
    expect(validateMark('-1', false, 20)).toBe('Cannot be negative')
    expect(validateMark('abc', false, 20)).toBe('Enter a number')
    expect(validateMark('1.234', false, 20)).toBe('Use at most 2 decimal places')
  })

  it('ignores the value for an absent student', () => {
    expect(validateMark('999', true, 20)).toBeNull()
  })
})

describe('computeMarkStats', () => {
  it('averages only valid entered marks, not blanks, absences or invalid values', () => {
    const s = computeMarkStats(
      [
        { value: '10', absent: false },
        { value: '20', absent: false },
        { value: '', absent: false },
        { value: '', absent: true },
        { value: '99', absent: false },
      ],
      20,
    )
    expect(s.average).toBe(15)
    expect(s.averagePercent).toBe(75)
    expect(s.high).toBe(20)
    expect(s.low).toBe(10)
    expect(s.graded).toBe(2)
    expect(s.absent).toBe(1)
    expect(s.total).toBe(5)
    expect(s.completion).toBe(60)
  })

  it('handles an empty sheet', () => {
    const s = computeMarkStats([], 20)
    expect([s.average, s.high, s.low, s.completion]).toEqual([null, null, null, 0])
  })
})
