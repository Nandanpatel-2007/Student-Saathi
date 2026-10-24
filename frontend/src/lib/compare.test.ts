import { describe, expect, it } from 'vitest'

import { compare, compareDiff, describeComparison, formatDiff } from './compare'

describe('compare', () => {
  it('reports above, below and level', () => {
    expect(compare(82, 76)).toEqual({ direction: 'above', diff: 6 })
    expect(compare(70, 76.5)).toEqual({ direction: 'below', diff: -6.5 })
    expect(compare(50, 50)).toEqual({ direction: 'level', diff: 0 })
  })

  it('treats differences that round to 0.0 as level', () => {
    expect(compare(50.04, 50)?.direction).toBe('level')
    expect(compare(49.96, 50)?.direction).toBe('level')
    expect(compare(50.06, 50)?.direction).toBe('above')
  })

  it('returns null when either side is missing, but 0 is a real value', () => {
    expect(compare(null, 50)).toBeNull()
    expect(compare(50, null)).toBeNull()
    expect(compare(undefined, undefined)).toBeNull()
    expect(compare(0, 40)).toEqual({ direction: 'below', diff: -40 })
  })
})

describe('compareDiff', () => {
  it('uses a server-side difference as is', () => {
    expect(compareDiff(33.33)).toEqual({ direction: 'above', diff: 33.3 })
    expect(compareDiff(-41.67)).toEqual({ direction: 'below', diff: -41.7 })
    expect(compareDiff(0)).toEqual({ direction: 'level', diff: 0 })
    expect(compareDiff(null)).toBeNull()
  })
})

describe('formatting', () => {
  it('formats the signed difference with a real minus sign', () => {
    expect(formatDiff(compare(82, 76))).toBe('+6.0 pts')
    expect(formatDiff(compare(70, 76.5))).toBe('−6.5 pts')
    expect(formatDiff(compare(50, 50))).toBe('0 pts')
    expect(formatDiff(null)).toBe('—')
  })

  it('describes the comparison in words', () => {
    expect(describeComparison(compare(82, 76))).toBe('6.0 points above the class average')
    expect(describeComparison(compare(75, 76))).toBe('1.0 point below the class average')
    expect(describeComparison(compare(50, 50))).toBe('Level with the class average')
    expect(describeComparison(null)).toBe('No data yet')
  })
})
