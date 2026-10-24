import { z } from 'zod'

/** Response shapes shared by the faculty and student portals. */

export const subjectSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  credits: z.number().optional(),
  semester: z.number().optional(),
})

export const alertSchema = z.object({
  code: z.enum(['LOW_ATTENDANCE', 'ATTENDANCE_WARNING', 'FAILING_SUBJECT', 'SHARP_DROP']),
  severity: z.enum(['critical', 'warning']),
  message: z.string(),
  subject_id: z.number().nullish(),
  subject_code: z.string().nullish(),
})

export type Alert = z.infer<typeof alertSchema>
