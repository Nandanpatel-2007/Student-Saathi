import { useMemo, useState } from 'react'

import {
  createTeachingAssignment,
  updateTeachingAssignment,
  type FacultyLookup,
  type SectionRecord,
  type SubjectRecord,
  type TeachingAssignmentRecord,
} from '../../lib/admin-api'
import { errorMessage } from '../../lib/format'
import { Button } from '../ui/Button'
import { SelectField } from '../ui/SelectField'
import { StatusMessage } from '../ui/StatusMessage'

interface Props {
  assignment?: TeachingAssignmentRecord
  faculty: readonly FacultyLookup[]
  subjects: readonly SubjectRecord[]
  sections: readonly SectionRecord[]
  onSaved: (assignment: TeachingAssignmentRecord) => void
  onCancel: () => void
}

type Errors = Partial<Record<'faculty' | 'subject' | 'section', string>>

export function TeachingAssignmentForm({ assignment, faculty, subjects, sections, onSaved, onCancel }: Props) {
  const [facultyId, setFacultyId] = useState(assignment ? String(assignment.faculty.id) : '')
  const [subjectId, setSubjectId] = useState(assignment ? String(assignment.subject.id) : '')
  const [sectionId, setSectionId] = useState(assignment ? String(assignment.section.id) : '')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const facultyOptions = useMemo(
    () => [
      { value: '', label: 'Choose a faculty member' },
      ...faculty.map((f) => ({ value: String(f.id), label: `${f.name} (${f.employee_id}) · ${f.department.code}` })),
    ],
    [faculty],
  )
  const subjectOptions = useMemo(
    () => [{ value: '', label: 'Choose a subject' }, ...subjects.map((s) => ({ value: String(s.id), label: `${s.code} · ${s.name}` }))],
    [subjects],
  )
  const sectionOptions = useMemo(
    () => [
      { value: '', label: 'Choose a section' },
      ...sections.map((s) => ({ value: String(s.id), label: `${s.program} · sem ${s.semester} · ${s.name} (${s.academic_year})` })),
    ],
    [sections],
  )

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const next: Errors = {}
    if (!facultyId) next.faculty = 'Choose a faculty member.'
    if (!subjectId) next.subject = 'Choose a subject.'
    if (!sectionId) next.section = 'Choose a section.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length > 0) return

    const input = { faculty_id: Number(facultyId), subject_id: Number(subjectId), section_id: Number(sectionId) }
    setSaving(true)
    try {
      onSaved(assignment ? await updateTeachingAssignment(assignment.id, input) : await createTeachingAssignment(input))
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-5">
      <SelectField label="Faculty member" value={facultyId} onChange={setFacultyId} options={facultyOptions} error={errors.faculty} />
      <SelectField label="Subject" value={subjectId} onChange={setSubjectId} options={subjectOptions} error={errors.subject} />
      <SelectField label="Section" value={sectionId} onChange={setSectionId} options={sectionOptions} error={errors.section} />

      <StatusMessage notice={formError ? { tone: 'error', text: formError } : null} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {assignment ? 'Save changes' : 'Assign'}
        </Button>
      </div>
    </form>
  )
}
