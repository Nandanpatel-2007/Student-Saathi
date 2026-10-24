import { z } from 'zod'

/** Response shapes shared by the faculty, student and admin portals. */

/** Lenient subject shape used where the API may omit credits/semester (student dashboard). */
export const subjectSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  credits: z.number().optional(),
  semester: z.number().optional(),
})

/** Full subject as returned by /subjects. */
export const subjectDetailSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  credits: z.number(),
  semester: z.number(),
})

export const sectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  program: z.string(),
  semester: z.number(),
  academic_year: z.string(),
})

export const studentBriefSchema = z.object({
  id: z.number(),
  roll_no: z.string(),
  name: z.string(),
})

export const alertSchema = z.object({
  code: z.enum(['LOW_ATTENDANCE', 'ATTENDANCE_WARNING', 'FAILING_SUBJECT', 'SHARP_DROP']),
  severity: z.enum(['critical', 'warning']),
  message: z.string(),
  subject_id: z.number().nullish(),
  subject_code: z.string().nullish(),
})

/** The standard paginated list envelope. */
export function paged<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    count: z.number(),
    page: z.number(),
    page_size: z.number(),
    total_pages: z.number(),
  })
}

export type Alert = z.infer<typeof alertSchema>
export type Subject = z.infer<typeof subjectDetailSchema>
export type Section = z.infer<typeof sectionSchema>
export type StudentBrief = z.infer<typeof studentBriefSchema>
export type Paged<T> = { items: T[]; count: number; page: number; page_size: number; total_pages: number }
