import { z } from 'zod'

import { apiRequest, buildQuery } from './api'
import { paged, sectionSchema, studentBriefSchema, subjectDetailSchema, type Paged } from './schemas'

// ---------------------------------------------------------------- overview and lookups

const overviewSchema = z.object({
  students: z.number(),
  faculty: z.number(),
  subjects: z.number(),
  sections: z.number(),
  teaching_assignments: z.number(),
  enrollments: z.number(),
})
export type Overview = z.infer<typeof overviewSchema>

export function fetchOverview(): Promise<Overview> {
  return apiRequest('/admin/overview', overviewSchema, { auth: true })
}

const facultyLookupSchema = z.object({
  id: z.number(),
  employee_id: z.string(),
  name: z.string(),
  department: z.object({ id: z.number(), name: z.string(), code: z.string() }),
})
export type FacultyLookup = z.infer<typeof facultyLookupSchema>

const studentLookupSchema = z.object({
  id: z.number(),
  roll_no: z.string(),
  name: z.string(),
  admission_year: z.number(),
  section: sectionSchema,
})
export type StudentLookup = z.infer<typeof studentLookupSchema>

interface ListParams {
  page?: number
  pageSize?: number
  search?: string
}

export function listFaculty({ page = 1, pageSize = 100, search }: ListParams = {}): Promise<Paged<FacultyLookup>> {
  const query = buildQuery({ page, page_size: pageSize, search })
  return apiRequest(`/admin/faculty${query}`, paged(facultyLookupSchema), { auth: true })
}

export function listStudents({
  page = 1,
  pageSize = 10,
  search,
  sectionId,
}: ListParams & { sectionId?: number } = {}): Promise<Paged<StudentLookup>> {
  const query = buildQuery({ page, page_size: pageSize, search, section_id: sectionId })
  return apiRequest(`/admin/students${query}`, paged(studentLookupSchema), { auth: true })
}

// ---------------------------------------------------------------- subjects

export type SubjectRecord = z.infer<typeof subjectDetailSchema>
export interface SubjectInput {
  code: string
  name: string
  credits: number
  semester: number
}

export function listSubjectsPage({ page = 1, pageSize = 15, search }: ListParams = {}): Promise<Paged<SubjectRecord>> {
  const query = buildQuery({ page, page_size: pageSize, search })
  return apiRequest(`/subjects${query}`, paged(subjectDetailSchema), { auth: true })
}

export function createSubject(input: SubjectInput): Promise<SubjectRecord> {
  return apiRequest('/subjects', subjectDetailSchema, { method: 'POST', body: input, auth: true })
}

export function updateSubject(id: number, input: SubjectInput): Promise<SubjectRecord> {
  return apiRequest(`/subjects/${id}`, subjectDetailSchema, { method: 'PUT', body: input, auth: true })
}

export function deleteSubject(id: number): Promise<undefined> {
  return apiRequest(`/subjects/${id}`, z.undefined(), { method: 'DELETE', auth: true })
}

// ---------------------------------------------------------------- sections

export type SectionRecord = z.infer<typeof sectionSchema>
export interface SectionInput {
  name: string
  program: string
  semester: number
  academic_year: string
}

export function listSectionsPage({ page = 1, pageSize = 15, search }: ListParams = {}): Promise<Paged<SectionRecord>> {
  const query = buildQuery({ page, page_size: pageSize, search })
  return apiRequest(`/sections${query}`, paged(sectionSchema), { auth: true })
}

export function createSection(input: SectionInput): Promise<SectionRecord> {
  return apiRequest('/sections', sectionSchema, { method: 'POST', body: input, auth: true })
}

export function updateSection(id: number, input: SectionInput): Promise<SectionRecord> {
  return apiRequest(`/sections/${id}`, sectionSchema, { method: 'PUT', body: input, auth: true })
}

export function deleteSection(id: number): Promise<undefined> {
  return apiRequest(`/sections/${id}`, z.undefined(), { method: 'DELETE', auth: true })
}

// ---------------------------------------------------------------- teaching assignments

const teachingAssignmentSchema = z.object({
  id: z.number(),
  faculty: z.object({ id: z.number(), employee_id: z.string(), name: z.string() }),
  subject: subjectDetailSchema,
  section: sectionSchema,
})
export type TeachingAssignmentRecord = z.infer<typeof teachingAssignmentSchema>
export interface TeachingAssignmentInput {
  faculty_id: number
  subject_id: number
  section_id: number
}

export function listTeachingAssignments({
  page = 1,
  pageSize = 15,
  subjectId,
  sectionId,
  facultyId,
}: ListParams & { subjectId?: number; sectionId?: number; facultyId?: number } = {}): Promise<
  Paged<TeachingAssignmentRecord>
> {
  const query = buildQuery({
    page,
    page_size: pageSize,
    subject_id: subjectId,
    section_id: sectionId,
    faculty_id: facultyId,
  })
  return apiRequest(`/teaching-assignments${query}`, paged(teachingAssignmentSchema), { auth: true })
}

export function createTeachingAssignment(input: TeachingAssignmentInput): Promise<TeachingAssignmentRecord> {
  return apiRequest('/teaching-assignments', teachingAssignmentSchema, { method: 'POST', body: input, auth: true })
}

export function updateTeachingAssignment(
  id: number,
  input: TeachingAssignmentInput,
): Promise<TeachingAssignmentRecord> {
  return apiRequest(`/teaching-assignments/${id}`, teachingAssignmentSchema, {
    method: 'PUT',
    body: input,
    auth: true,
  })
}

export function deleteTeachingAssignment(id: number): Promise<undefined> {
  return apiRequest(`/teaching-assignments/${id}`, z.undefined(), { method: 'DELETE', auth: true })
}

// ---------------------------------------------------------------- enrollments

const enrollmentSchema = z.object({
  id: z.number(),
  student: studentBriefSchema,
  subject: subjectDetailSchema,
})
export type EnrollmentRecord = z.infer<typeof enrollmentSchema>

const bulkEnrollSchema = z.object({
  section_id: z.number(),
  subject_id: z.number(),
  enrolled: z.number(),
  already_enrolled: z.number(),
})
export type BulkEnrollResult = z.infer<typeof bulkEnrollSchema>

export function listEnrollments({
  page = 1,
  pageSize = 15,
  subjectId,
  sectionId,
}: ListParams & { subjectId?: number; sectionId?: number } = {}): Promise<Paged<EnrollmentRecord>> {
  const query = buildQuery({ page, page_size: pageSize, subject_id: subjectId, section_id: sectionId })
  return apiRequest(`/enrollments${query}`, paged(enrollmentSchema), { auth: true })
}

export function enrollStudent(input: { student_id: number; subject_id: number }): Promise<EnrollmentRecord> {
  return apiRequest('/enrollments', enrollmentSchema, { method: 'POST', body: input, auth: true })
}

export function enrollSection(input: { section_id: number; subject_id: number }): Promise<BulkEnrollResult> {
  return apiRequest('/enrollments/bulk', bulkEnrollSchema, { method: 'POST', body: input, auth: true })
}

export function deleteEnrollment(id: number): Promise<undefined> {
  return apiRequest(`/enrollments/${id}`, z.undefined(), { method: 'DELETE', auth: true })
}
