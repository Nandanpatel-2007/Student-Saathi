import { z } from 'zod'

import { apiDownload, apiRequest, buildQuery } from './api'
import { saveBlob } from './download'
import { paged, sectionSchema, studentBriefSchema, subjectDetailSchema, type Paged } from './schemas'

export const SUBMISSION_STATUSES = ['NOT_SUBMITTED', 'SUBMITTED', 'LATE', 'GRADED', 'OVERDUE_MISSING'] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

const statusSchema = z.enum(SUBMISSION_STATUSES)
const timingSchema = z.enum(['ON_TIME', 'LATE'])

// ---------------------------------------------------------------- faculty: assignments

const assignmentSchema = z.object({
  id: z.number(),
  teaching_assignment_id: z.number(),
  subject: subjectDetailSchema,
  section: sectionSchema,
  title: z.string(),
  description: z.string(),
  created_at: z.string(),
  due_at: z.string(),
  max_marks: z.number(),
  allow_late_submissions: z.boolean(),
  total_students: z.number(),
  submitted_count: z.number(),
  late_count: z.number(),
  graded_count: z.number(),
})
export type AssignmentRecord = z.infer<typeof assignmentSchema>

export interface AssignmentInput {
  title: string
  description: string
  /** An ISO instant (UTC is fine). */
  due_at: string
  max_marks: number
  allow_late_submissions: boolean
}

export async function listAssignments(teachingAssignmentId: number): Promise<AssignmentRecord[]> {
  const query = buildQuery({ teaching_assignment_id: teachingAssignmentId, page_size: 100 })
  const page = await apiRequest(`/assignments${query}`, paged(assignmentSchema), { auth: true })
  return page.items
}

export function getAssignment(id: number): Promise<AssignmentRecord> {
  return apiRequest(`/assignments/${id}`, assignmentSchema, { auth: true })
}

export function createAssignment(teachingAssignmentId: number, input: AssignmentInput): Promise<AssignmentRecord> {
  return apiRequest('/assignments', assignmentSchema, {
    method: 'POST',
    body: { teaching_assignment_id: teachingAssignmentId, ...input },
    auth: true,
  })
}

export function updateAssignment(id: number, input: AssignmentInput): Promise<AssignmentRecord> {
  return apiRequest(`/assignments/${id}`, assignmentSchema, { method: 'PUT', body: input, auth: true })
}

export function deleteAssignment(id: number): Promise<undefined> {
  return apiRequest(`/assignments/${id}`, z.undefined(), { method: 'DELETE', auth: true })
}

// ---------------------------------------------------------------- faculty: submissions and grading

const submissionRowSchema = z.object({
  student: studentBriefSchema,
  status: statusSchema,
  timing: timingSchema.nullable(),
  offset_seconds: z.number().nullable(),
  submitted_at: z.string().nullable(),
  original_name: z.string().nullable(),
  size: z.number().nullable(),
  note: z.string(),
  marks_obtained: z.number().nullable(),
  feedback: z.string(),
  graded_at: z.string().nullable(),
})
export type SubmissionRow = z.infer<typeof submissionRowSchema>

/** Every enrolled student's row (the API pages at 100, so keep fetching until done). */
export async function listAllSubmissions(assignmentId: number): Promise<SubmissionRow[]> {
  const rows: SubmissionRow[] = []
  for (let page = 1; ; page += 1) {
    const query = buildQuery({ page, page_size: 100 })
    const result: Paged<SubmissionRow> = await apiRequest(
      `/assignments/${assignmentId}/submissions${query}`,
      paged(submissionRowSchema),
      { auth: true },
    )
    rows.push(...result.items)
    if (page >= result.total_pages) return rows
  }
}

export function gradeSubmission(
  assignmentId: number,
  studentId: number,
  input: { marks_obtained: number; feedback: string },
): Promise<SubmissionRow> {
  return apiRequest(`/assignments/${assignmentId}/submissions/${studentId}/grade`, submissionRowSchema, {
    method: 'PUT',
    body: input,
    auth: true,
  })
}

/** Fetch with the bearer token, then hand the file to the browser under its original name. */
export async function downloadSubmissionFile(
  assignmentId: number,
  studentId: number,
  filename: string,
): Promise<void> {
  saveBlob(await apiDownload(`/assignments/${assignmentId}/submissions/${studentId}/file`), filename)
}

export async function downloadSubmissionsCsv(assignment: Pick<AssignmentRecord, 'id' | 'title'>): Promise<void> {
  const blob = await apiDownload(`/assignments/${assignment.id}/export`)
  saveBlob(blob, `${assignment.title}-submissions.csv`.replace(/\s+/g, '_'))
}

// ---------------------------------------------------------------- student

const submissionSummarySchema = z.object({
  original_name: z.string(),
  size: z.number(),
  note: z.string(),
  submitted_at: z.string(),
})

const studentAssignmentSchema = z.object({
  assignment_id: z.number(),
  teaching_assignment_id: z.number(),
  title: z.string(),
  description: z.string(),
  subject: subjectDetailSchema,
  section: sectionSchema,
  due_at: z.string(),
  max_marks: z.number(),
  allow_late_submissions: z.boolean(),
  status: statusSchema,
  timing: timingSchema.nullable(),
  offset_seconds: z.number().nullable(),
  submission: submissionSummarySchema.nullable(),
  marks_obtained: z.number().nullable(),
  feedback: z.string(),
  graded_at: z.string().nullable(),
})
export type StudentAssignment = z.infer<typeof studentAssignmentSchema>

export async function listMyAssignments(): Promise<StudentAssignment[]> {
  const page = await apiRequest('/students/me/assignments?page_size=100', paged(studentAssignmentSchema), {
    auth: true,
  })
  return page.items
}

/** Multipart upload; the server sets the submission time. */
export function submitAssignment(assignmentId: number, file: File, note: string): Promise<StudentAssignment> {
  const form = new FormData()
  form.append('file', file)
  form.append('note', note)
  return apiRequest(`/assignments/${assignmentId}/submission`, studentAssignmentSchema, {
    method: 'POST',
    body: form,
    auth: true,
  })
}

export function withdrawSubmission(assignmentId: number): Promise<undefined> {
  return apiRequest(`/assignments/${assignmentId}/submission`, z.undefined(), { method: 'DELETE', auth: true })
}
