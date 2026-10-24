import { Trash2, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DataTable, type Column } from '../../components/faculty/DataTable'
import { PageTitle } from '../../components/faculty/PageTitle'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Pagination } from '../../components/ui/Pagination'
import { SearchField } from '../../components/ui/SearchField'
import { SelectField } from '../../components/ui/SelectField'
import { StatusMessage, type Notice } from '../../components/ui/StatusMessage'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useSearchPaging } from '../../hooks/useSearchPaging'
import {
  deleteEnrollment,
  enrollSection,
  enrollStudent,
  listEnrollments,
  listSectionsPage,
  listStudents,
  listSubjectsPage,
  type EnrollmentRecord,
  type StudentLookup,
} from '../../lib/admin-api'
import { errorMessage } from '../../lib/format'

export function EnrollmentsPage() {
  const [subjectId, setSubjectId] = useState('')
  const [bulkSection, setBulkSection] = useState('')
  const [listSection, setListSection] = useState('')
  const [listPaging, setListPaging] = useState({ key: '', page: 1 })
  const [bulkBusy, setBulkBusy] = useState(false)
  const [busyStudent, setBusyStudent] = useState<number | null>(null)
  const [removing, setRemoving] = useState<EnrollmentRecord | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const studentSearch = useSearchPaging()

  const options = useAsyncData('admin-enroll-options', async () => {
    const [subjects, sections] = await Promise.all([listSubjectsPage({ pageSize: 100 }), listSectionsPage({ pageSize: 100 })])
    return { subjects: subjects.items, sections: sections.items }
  })

  const subjectOptions = useMemo(
    () => [
      { value: '', label: 'Choose a subject' },
      ...(options.data?.subjects ?? []).map((s) => ({ value: String(s.id), label: `${s.code} · ${s.name}` })),
    ],
    [options.data],
  )
  const sectionLabel = (s: { program: string; semester: number; name: string; academic_year: string }) =>
    `${s.program} · sem ${s.semester} · ${s.name} (${s.academic_year})`
  const bulkOptions = useMemo(
    () => [{ value: '', label: 'Choose a section' }, ...(options.data?.sections ?? []).map((s) => ({ value: String(s.id), label: sectionLabel(s) }))],
    [options.data],
  )
  const filterOptions = useMemo(
    () => [{ value: '', label: 'All sections' }, ...(options.data?.sections ?? []).map((s) => ({ value: String(s.id), label: sectionLabel(s) }))],
    [options.data],
  )

  const subject = options.data?.subjects.find((s) => String(s.id) === subjectId)

  const listKey = `${subjectId}:${listSection}`
  const listPage = listPaging.key === listKey ? listPaging.page : 1
  const enrollments = useAsyncData(subjectId ? `admin-enrollments:${listKey}:${listPage}` : null, () =>
    listEnrollments({
      page: listPage,
      subjectId: Number(subjectId),
      sectionId: listSection ? Number(listSection) : undefined,
    }),
  )

  const students = useAsyncData(subjectId ? `admin-enroll-students:${studentSearch.term}:${studentSearch.page}` : null, () =>
    listStudents({ page: studentSearch.page, pageSize: 6, search: studentSearch.term }),
  )

  const doBulk = async () => {
    if (!subjectId || !bulkSection) return
    setBulkBusy(true)
    setNotice(null)
    try {
      const result = await enrollSection({ section_id: Number(bulkSection), subject_id: Number(subjectId) })
      const text =
        result.enrolled === 0
          ? `Nobody new to enrol: all ${result.already_enrolled} student${result.already_enrolled === 1 ? ' is' : 's are'} already in ${subject?.code}.`
          : `Enrolled ${result.enrolled} student${result.enrolled === 1 ? '' : 's'} in ${subject?.code}` +
            (result.already_enrolled ? ` (${result.already_enrolled} were already enrolled).` : '.')
      setNotice({ tone: result.enrolled === 0 ? 'info' : 'success', text })
      enrollments.reload()
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setBulkBusy(false)
    }
  }

  const doEnroll = async (student: StudentLookup) => {
    setBusyStudent(student.id)
    setNotice(null)
    try {
      await enrollStudent({ student_id: student.id, subject_id: Number(subjectId) })
      setNotice({ tone: 'success', text: `Enrolled ${student.name} (${student.roll_no}) in ${subject?.code}.` })
      enrollments.reload()
    } catch (error) {
      setNotice({ tone: 'error', text: `${student.name}: ${errorMessage(error)}` })
    } finally {
      setBusyStudent(null)
    }
  }

  const doRemove = async (enrollment: EnrollmentRecord) => {
    setRemoveBusy(true)
    setRemoveError(null)
    try {
      await deleteEnrollment(enrollment.id)
      setRemoving(null)
      setNotice({ tone: 'success', text: `Removed ${enrollment.student.name} from ${enrollment.subject.code}.` })
      enrollments.reload()
    } catch (error) {
      setRemoveError(errorMessage(error))
    } finally {
      setRemoveBusy(false)
    }
  }

  const enrollmentColumns: Column<EnrollmentRecord>[] = [
    { key: 'roll', header: 'Roll no.', cell: (e) => <span className="whitespace-nowrap">{e.student.roll_no}</span> },
    { key: 'name', header: 'Student', cell: (e) => <span className="font-medium">{e.student.name}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (e) => (
        <Button size="sm" onClick={() => setRemoving(e)}>
          <Trash2 className="size-4" aria-hidden="true" />
          <span className="sr-only">Remove {e.student.name} from {e.subject.code}</span>
        </Button>
      ),
    },
  ]

  const studentColumns: Column<StudentLookup>[] = [
    { key: 'roll', header: 'Roll no.', cell: (s) => <span className="whitespace-nowrap">{s.roll_no}</span> },
    { key: 'name', header: 'Student', cell: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'section', header: 'Section', cell: (s) => `${s.section.program} · ${s.section.name}` },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (s) => (
        <Button size="sm" loading={busyStudent === s.id} disabled={busyStudent !== null} onClick={() => doEnroll(s)}>
          {busyStudent !== s.id && <UserPlus className="size-4" aria-hidden="true" />}
          Enrol
          <span className="sr-only"> {s.name} in {subject?.code}</span>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageTitle title="Enrollments" subtitle="Choose a subject, then enrol a whole section or individual students." />

      {options.error ? (
        <Card>
          <ErrorState message={errorMessage(options.error)} onRetry={options.reload} />
        </Card>
      ) : (
        <Card>
          <div className="p-5 sm:max-w-md">
            <SelectField
              label="Subject"
              value={subjectId}
              onChange={(next) => {
                setSubjectId(next)
                setNotice(null)
              }}
              options={subjectOptions}
              disabled={options.loading}
            />
          </div>
        </Card>
      )}

      <StatusMessage notice={notice} />

      {!subjectId ? (
        <Card>
          <EmptyState title="Choose a subject to begin" body="You will see who is enrolled and be able to add more students." />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Enrol a whole section" subtitle="Everyone in the section who isn’t enrolled yet is added. Running it again is harmless." />
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
              <SelectField label="Section" value={bulkSection} onChange={setBulkSection} options={bulkOptions} className="sm:flex-1" />
              <Button variant="primary" onClick={doBulk} loading={bulkBusy} disabled={!bulkSection}>
                {!bulkBusy && <Users className="size-4" aria-hidden="true" />}
                Enrol section
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Enrol individual students" subtitle="Search by name, username or roll number." />
            <div className="p-5 sm:max-w-md">
              <SearchField label="Find a student" value={studentSearch.search} onChange={studentSearch.setSearch} placeholder="Name or roll number" />
            </div>
            {students.error ? (
              <ErrorState message={errorMessage(students.error)} onRetry={students.reload} />
            ) : students.loading ? (
              <LoadingBlock label="Searching students…" rows={3} />
            ) : !students.data || students.data.count === 0 ? (
              <EmptyState title="No students found" body="Try a different name or roll number." />
            ) : (
              <>
                <DataTable caption="Students" columns={studentColumns} rows={students.data.items} rowKey={(s) => s.id} />
                <Pagination
                  page={students.data.page}
                  totalPages={students.data.total_pages}
                  count={students.data.count}
                  noun="student"
                  busy={students.refreshing}
                  onPage={studentSearch.setPage}
                />
              </>
            )}
          </Card>

          <Card>
            <CardHeader title={`Enrolled in ${subject?.code ?? 'this subject'}`} subtitle={subject?.name} />
            <div className="p-5 sm:max-w-md">
              <SelectField
                label="Filter by section"
                value={listSection}
                onChange={(next) => {
                  setListSection(next)
                  setListPaging({ key: `${subjectId}:${next}`, page: 1 })
                }}
                options={filterOptions}
              />
            </div>
            {enrollments.error ? (
              <ErrorState message={errorMessage(enrollments.error)} onRetry={enrollments.reload} />
            ) : enrollments.loading ? (
              <LoadingBlock label="Loading enrollments…" rows={5} />
            ) : !enrollments.data || enrollments.data.count === 0 ? (
              <EmptyState title="Nobody is enrolled yet" body="Enrol a section or search for individual students above." />
            ) : (
              <>
                <DataTable caption="Enrolled students" columns={enrollmentColumns} rows={enrollments.data.items} rowKey={(e) => e.id} />
                <Pagination
                  page={enrollments.data.page}
                  totalPages={enrollments.data.total_pages}
                  count={enrollments.data.count}
                  noun="enrollment"
                  busy={enrollments.refreshing}
                  onPage={(next) => setListPaging({ key: listKey, page: next })}
                />
              </>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove this enrollment?"
        confirmLabel="Remove enrollment"
        busy={removeBusy}
        error={removeError}
        onConfirm={() => removing && doRemove(removing)}
        onClose={() => {
          setRemoving(null)
          setRemoveError(null)
        }}
      >
        <p>
          <strong className="text-ink">
            {removing?.student.name} ({removing?.student.roll_no})
          </strong>{' '}
          will no longer be part of {removing?.subject.code}.
        </p>
        <p className="mt-2">
          They stop appearing on new attendance sheets and mark sheets. Records that already exist are kept.
        </p>
      </ConfirmDialog>
    </div>
  )
}
