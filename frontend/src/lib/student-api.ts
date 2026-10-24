import { z } from 'zod'

import { apiRequest } from './api'
import { alertSchema, subjectSchema } from './schemas'

const subjectStatsSchema = z.object({
  subject: subjectSchema,
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  excused: z.number(),
  classes_held: z.number(),
  attendance_pct: z.number().nullable(),
  /** Classes to attend in a row to reach the threshold; 0 when already there. */
  classes_needed_for_threshold: z.number().nullable(),
  weighted_score: z.number().nullable(),
  class_avg: z.number().nullable(),
  /** This student's own percentile in the class. */
  percentile: z.number().nullable(),
  alerts: z.array(alertSchema),
})

const trendPointSchema = z.object({
  /** "YYYY-MM" */
  month: z.string(),
  attendance_pct: z.number().nullable(),
  classes: z.number(),
})

const dashboardSchema = z.object({
  attendance_overall: z.number().nullable(),
  subjects: z.array(subjectStatsSchema),
  alerts: z.array(alertSchema),
  trend: z.array(trendPointSchema),
})

export type SubjectStats = z.infer<typeof subjectStatsSchema>
export type TrendPoint = z.infer<typeof trendPointSchema>
export type StudentDashboard = z.infer<typeof dashboardSchema>

/** The single source for the whole student portal. */
export function fetchStudentDashboard(): Promise<StudentDashboard> {
  return apiRequest('/students/me/dashboard', dashboardSchema, { auth: true })
}
