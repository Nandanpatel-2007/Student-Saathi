import { z } from 'zod'

import { apiDownload, apiRequest, buildQuery } from './api'

// ---------------------------------------------------------------- shared schemas

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const ASSESSMENT_TYPES = ['QUIZ', 'MIDTERM', 'ASSIGNMENT', 'PRACTICAL', 'OTHER'] as const
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number]

const subjectSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  credits: z.number(),
  semester: z.number(),
})

const sectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  program: z.string(),
  semester: z.number(),
  academic_year: z.string(),
})

const studentBriefSchema = z.object({
  id: z.number(),
  roll_no: z.string(),
  name: z.string(),
})

const alertSchema = z.object({
  code: z.enum(['LOW_ATTENDANCE', 'ATTENDANCE_WARNING', 'FAILING_SUBJECT', 'SHARP_DROP']),
  severity: z.enum(['critical', 'warning']),
  message: z.string(),
  subject_id: z.number().nullish(),
  subject_code: z.string().nullish(),
})

function paged<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    count: z.number(),
    page: z.number(),
    page_size: z.number(),
    total_pages: z.number(),
  })
}

export type Subject = z.infer<typeof subjectSchema>
export type Section = z.infer<typeof sectionSchema>
export type StudentBrief = z.infer<typeof studentBriefSchema>
export type Alert = z.infer<typeof alertSchema>
export type Paged<T> = { items: T[]; count: number; page: number; page_size: number; total_pages: number }

// ---------------------------------------------------------------- classes

const facultyClassSchema = z.object({
  assignment_id: z.number(),
  subject: subjectSchema,
  section: sectionSchema,
})
export type FacultyClass = z.infer<typeof facultyClassSchema>

export function classLabel(c: Pick<FacultyClass, 'subject' | 'section'>): string {
  return `${c.subject.code} · ${c.subject.name} (${c.section.name})`
}

export async function listMyClasses(): Promise<FacultyClass[]> {
  const page = await apiRequest('/faculty/me/classes?page_size=100', paged(facultyClassSchema), { auth: true })
  return page.items
}

// ---------------------------------------------------------------- analytics

const bucketSchema = z.object({ label: z.string(), min: z.number(), max: z.number(), count: z.number() })
export type HistogramBucket = z.infer<typeof bucketSchema>

const classSummarySchema = z.object({
  assignment_id: z.number(),
  subject: subjectSchema,
  section: sectionSchema,
  students: z.number(),
  sessions_held: z.number(),
  attendance_pct: z.number().nullable(),
  average_score: z.number().nullable(),
  marks_distribution: z.array(bucketSchema),
  at_risk_students: z.array(
    z.object({
      student: studentBriefSchema,
      attendance_pct: z.number().nullable(),
      weighted_score: z.number().nullable(),
      alerts: z.array(alertSchema),
    }),
  ),
})
export type ClassSummary = z.infer<typeof classSummarySchema>
export type AtRiskStudent = ClassSummary['at_risk_students'][number]

export function getClassSummary(assignmentId: number): Promise<ClassSummary> {
  return apiRequest(`/faculty/classes/${assignmentId}/summary`, classSummarySchema, { auth: true })
}

const classStudentSchema = z.object({
  student: studentBriefSchema,
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  excused: z.number(),
  attendance_pct: z.number().nullable(),
  classes_needed_for_threshold: z.number().nullable(),
  weighted_score: z.number().nullable(),
  rank: z.number().nullable(),
  percentile: z.number().nullable(),
  alerts: z.array(alertSchema),
})
export type ClassStudent = z.infer<typeof classStudentSchema>

export function listClassStudents(
  assignmentId: number,
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {},
): Promise<Paged<ClassStudent>> {
  const query = buildQuery({ page, page_size: pageSize })
  return apiRequest(`/faculty/classes/${assignmentId}/students${query}`, paged(classStudentSchema), {
    auth: true,
  })
}

export async function downloadClassCsv(
  c: Pick<FacultyClass, 'assignment_id' | 'subject' | 'section'>,
  type: 'attendance' | 'marks',
): Promise<void> {
  const blob = await apiDownload(`/faculty/classes/${c.assignment_id}/export${buildQuery({ type })}`)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${c.subject.code}-${c.section.name}-${type}.csv`.replace(/\s+/g, '_')
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------- attendance

const sessionBase = {
  id: z.number(),
  teaching_assignment_id: z.number(),
  subject: subjectSchema,
  section: sectionSchema,
  date: z.string(),
  period: z.number(),
  topic: z.string(),
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  excused: z.number(),
  total: z.number(),
  updated_at: z.string(),
  updated_by_name: z.string().nullish(),
}

const sessionSummarySchema = z.object(sessionBase)
const sessionDetailSchema = z.object({
  ...sessionBase,
  records: z.array(
    z.object({
      student: studentBriefSchema,
      status: z.enum(ATTENDANCE_STATUSES),
      updated_at: z.string(),
      updated_by_name: z.string().nullish(),
    }),
  ),
})

export type SessionSummary = z.infer<typeof sessionSummarySchema>
export type SessionDetail = z.infer<typeof sessionDetailSchema>

export interface SessionFilters {
  subject?: number
  section?: number
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export function listSessions(filters: SessionFilters = {}): Promise<Paged<SessionSummary>> {
  const query = buildQuery({
    subject: filters.subject,
    section: filters.section,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    page: filters.page,
    page_size: filters.pageSize,
  })
  return apiRequest(`/attendance/sessions${query}`, paged(sessionSummarySchema), { auth: true })
}

/** Sessions of one class (subject + section), newest first. Verified client-side by assignment id. */
export async function listClassSessions(c: FacultyClass, pageSize = 100): Promise<SessionSummary[]> {
  const page = await listSessions({ subject: c.subject.id, section: c.section.id, pageSize })
  return page.items.filter((s) => s.teaching_assignment_id === c.assignment_id)
}

/** The session for this class on `date` in `period`, if one exists. */
export async function findClassSession(
  c: FacultyClass,
  date: string,
  period: number,
): Promise<SessionSummary | undefined> {
  const page = await listSessions({
    subject: c.subject.id,
    section: c.section.id,
    dateFrom: date,
    dateTo: date,
    pageSize: 100,
  })
  return page.items.find(
    (s) => s.teaching_assignment_id === c.assignment_id && s.date === date && s.period === period,
  )
}

export function getSession(id: number): Promise<SessionDetail> {
  return apiRequest(`/attendance/sessions/${id}`, sessionDetailSchema, { auth: true })
}

export function createSession(body: {
  teaching_assignment_id: number
  date: string
  period: number
  topic?: string
}): Promise<SessionDetail> {
  return apiRequest('/attendance/sessions', sessionDetailSchema, { method: 'POST', body, auth: true })
}

export function updateRecords(
  sessionId: number,
  records: Array<{ student_id: number; status: AttendanceStatus }>,
): Promise<SessionDetail> {
  return apiRequest(`/attendance/sessions/${sessionId}/records`, sessionDetailSchema, {
    method: 'PUT',
    body: { records },
    auth: true,
  })
}

// ---------------------------------------------------------------- assessments and marks

const assessmentSchema = z.object({
  id: z.number(),
  teaching_assignment_id: z.number(),
  subject: subjectSchema,
  section: sectionSchema,
  title: z.string(),
  type: z.enum(ASSESSMENT_TYPES),
  max_marks: z.number(),
  weightage_percent: z.number(),
  date: z.string(),
})
export type Assessment = z.infer<typeof assessmentSchema>

export interface AssessmentInput {
  title: string
  type: AssessmentType
  max_marks: number
  weightage_percent: number
  date: string
}

export async function listAssessments(assignmentId: number): Promise<Assessment[]> {
  const query = buildQuery({ teaching_assignment_id: assignmentId, page_size: 100 })
  const page = await apiRequest(`/assessments${query}`, paged(assessmentSchema), { auth: true })
  return page.items.filter((a) => a.teaching_assignment_id === assignmentId)
}

export function createAssessment(assignmentId: number, input: AssessmentInput): Promise<Assessment> {
  return apiRequest('/assessments', assessmentSchema, {
    method: 'POST',
    body: { teaching_assignment_id: assignmentId, ...input },
    auth: true,
  })
}

export function updateAssessment(id: number, input: AssessmentInput): Promise<Assessment> {
  return apiRequest(`/assessments/${id}`, assessmentSchema, { method: 'PUT', body: input, auth: true })
}

export function deleteAssessment(id: number): Promise<undefined> {
  return apiRequest(`/assessments/${id}`, z.undefined(), { method: 'DELETE', auth: true })
}

const marksSheetSchema = z.object({
  assessment: assessmentSchema,
  marks: z.array(
    z.object({
      student: studentBriefSchema,
      marks_obtained: z.number().nullable(),
      is_absent: z.boolean(),
    }),
  ),
})
export type MarksSheetData = z.infer<typeof marksSheetSchema>

export function getMarks(assessmentId: number): Promise<MarksSheetData> {
  return apiRequest(`/assessments/${assessmentId}/marks`, marksSheetSchema, { auth: true })
}

export function updateMarks(
  assessmentId: number,
  marks: Array<{ student_id: number; marks_obtained: number | null; is_absent: boolean }>,
): Promise<MarksSheetData> {
  return apiRequest(`/assessments/${assessmentId}/marks`, marksSheetSchema, {
    method: 'PUT',
    body: { marks },
    auth: true,
  })
}
