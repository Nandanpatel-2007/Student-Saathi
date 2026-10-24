import { describe, expect, it } from 'vitest'

import type { Alert } from './schemas'
import type { SubjectStats } from './student-api'
import {
  attendanceGap,
  classesNeededText,
  computeTotals,
  formatMonth,
  greeting,
  sortAlerts,
  subjectTone,
} from './student-derive'

const alert = (code: Alert['code'], severity: Alert['severity'], subject_code: string | null = null): Alert => ({
  code,
  severity,
  message: `${code} message`,
  subject_id: null,
  subject_code,
})

function subject(over: Partial<SubjectStats> = {}): SubjectStats {
  return {
    subject: { id: 1, code: 'S1', name: 'Subject' },
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    classes_held: 0,
    attendance_pct: null,
    class_avg_attendance_pct: null,
    classes_needed_for_threshold: null,
    average_score_pct: null,
    class_avg_score_pct: null,
    alerts: [],
    ...over,
  }
}

describe('formatMonth', () => {
  it('formats YYYY-MM as "Mon YYYY"', () => {
    expect(formatMonth('2026-09')).toBe('Sep 2026')
    expect(formatMonth('2026-01')).toBe('Jan 2026')
    expect(formatMonth('2026-12')).toBe('Dec 2026')
  })

  it('returns unparseable input unchanged', () => {
    expect(formatMonth('garbage')).toBe('garbage')
    expect(formatMonth('2026-13')).toBe('2026-13')
  })
})

describe('sortAlerts', () => {
  it('puts critical first, then groups by subject, keeping server order otherwise', () => {
    const sorted = sortAlerts([
      alert('ATTENDANCE_WARNING', 'warning', 'B'),
      alert('FAILING_SUBJECT', 'critical', 'C'),
      alert('SHARP_DROP', 'warning', 'A'),
      alert('LOW_ATTENDANCE', 'critical', 'A'),
    ])
    expect(sorted.map((a) => a.code)).toEqual(['LOW_ATTENDANCE', 'FAILING_SUBJECT', 'SHARP_DROP', 'ATTENDANCE_WARNING'])
  })
})

describe('subjectTone', () => {
  it('follows the severity the API reported', () => {
    expect(subjectTone([])).toBe('accent')
    expect(subjectTone([alert('SHARP_DROP', 'warning')])).toBe('warning')
    expect(subjectTone([alert('LOW_ATTENDANCE', 'critical'), alert('SHARP_DROP', 'warning')])).toBe('danger')
  })

  it('can be limited to some alert codes', () => {
    expect(subjectTone([alert('FAILING_SUBJECT', 'critical')], ['LOW_ATTENDANCE', 'ATTENDANCE_WARNING'])).toBe('accent')
  })
})

describe('missing data', () => {
  it('explains why there is no attendance percentage', () => {
    expect(attendanceGap(subject({ classes_held: 0 }))).toBe('No classes yet')
    expect(attendanceGap(subject({ classes_held: 3, excused: 3 }))).toBe('All recorded classes were excused')
    expect(attendanceGap(subject({ classes_held: 3, attendance_pct: 0 }))).toBeNull() // 0% is a real value
  })

  it('words the classes-needed hint', () => {
    expect(classesNeededText(null)).toBeNull()
    expect(classesNeededText(0)).toBe('You are at or above the attendance threshold.')
    expect(classesNeededText(1)).toBe('Attend 1 more class in a row to reach the threshold.')
    expect(classesNeededText(8)).toBe('Attend 8 more classes in a row to reach the threshold.')
  })
})

describe('computeTotals', () => {
  const totals = computeTotals([
    subject({
      subject: { id: 1, code: 'A', name: 'A' },
      classes_held: 10,
      present: 7,
      absent: 2,
      late: 1,
      attendance_pct: 80,
      class_avg_attendance_pct: 85,
      average_score_pct: 80,
      class_avg_score_pct: 70,
      alerts: [alert('LOW_ATTENDANCE', 'critical')],
    }),
    subject({
      subject: { id: 2, code: 'B', name: 'B' },
      classes_held: 5,
      present: 5,
      attendance_pct: 100,
      class_avg_attendance_pct: 90,
      average_score_pct: 40,
      class_avg_score_pct: 60,
      alerts: [alert('FAILING_SUBJECT', 'critical')],
    }),
    subject({ subject: { id: 3, code: 'C', name: 'C' } }),
  ])

  it('adds up the attendance counts', () => {
    expect([totals.held, totals.present, totals.absent, totals.late]).toEqual([15, 12, 2, 1])
  })

  it('picks the best subject and counts subjects below the class average', () => {
    expect(totals.best?.subject.code).toBe('A')
    expect(totals.belowClassScore).toBe(1)
    expect(totals.belowClassAttendance).toBe(1)
  })

  it('counts subjects by alert type', () => {
    expect(totals.subjectsWithAttendanceAlert).toBe(1)
    expect(totals.subjectsWithScoreAlert).toBe(1)
  })

  it('skips ungraded subjects instead of treating them as zero', () => {
    const only = computeTotals([subject()])
    expect(only.best).toBeNull()
    expect(only.belowClassScore).toBe(0)
    expect(computeTotals([]).held).toBe(0)
  })
})

describe('greeting', () => {
  it('changes at noon and at five', () => {
    // Hours are IST: 03:30Z is 09:00, 06:30Z is 12:00, 11:30Z is 17:00.
    expect(greeting(new Date('2026-01-01T03:30:00Z'))).toBe('Good morning')
    expect(greeting(new Date('2026-01-01T06:29:00Z'))).toBe('Good morning')
    expect(greeting(new Date('2026-01-01T06:30:00Z'))).toBe('Good afternoon')
    expect(greeting(new Date('2026-01-01T11:30:00Z'))).toBe('Good evening')
  })
})
