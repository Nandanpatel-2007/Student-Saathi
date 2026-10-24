import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { TeachingAssignmentForm } from '../../components/admin/TeachingAssignmentForm'
import { DataTable, type Column } from '../../components/faculty/DataTable'
import { PageTitle } from '../../components/faculty/PageTitle'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { SelectField } from '../../components/ui/SelectField'
import { StatusMessage, type Notice } from '../../components/ui/StatusMessage'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import {
  deleteTeachingAssignment,
  listFaculty,
  listSectionsPage,
  listSubjectsPage,
  listTeachingAssignments,
  type TeachingAssignmentRecord,
} from '../../lib/admin-api'
import { errorMessage } from '../../lib/format'

type Dialog =
  | { kind: 'form'; assignment?: TeachingAssignmentRecord }
  | { kind: 'delete'; assignment: TeachingAssignmentRecord }
  | null

export function TeachingPage() {
  const [subjectFilter, setSubjectFilter] = useState('')
  const [paging, setPaging] = useState({ filter: '', page: 1 })
  const page = paging.filter === subjectFilter ? paging.page : 1

  // Selects for the filter and the form (first 100 of each; plenty for a department).
  const options = useAsyncData('admin-teaching-options', async () => {
    const [faculty, subjects, sections] = await Promise.all([
      listFaculty({ pageSize: 100 }),
      listSubjectsPage({ pageSize: 100 }),
      listSectionsPage({ pageSize: 100 }),
    ])
    return { faculty: faculty.items, subjects: subjects.items, sections: sections.items }
  })

  const list = useAsyncData(`admin-teaching:${subjectFilter}:${page}`, () =>
    listTeachingAssignments({ page, subjectId: subjectFilter ? Number(subjectFilter) : undefined }),
  )

  const [dialog, setDialog] = useState<Dialog>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const subjectOptions = useMemo(
    () => [
      { value: '', label: 'All subjects' },
      ...(options.data?.subjects ?? []).map((s) => ({ value: String(s.id), label: `${s.code} · ${s.name}` })),
    ],
    [options.data],
  )

  const close = () => {
    setDialog(null)
    setDeleteError(null)
  }

  const confirmDelete = async (assignment: TeachingAssignmentRecord) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTeachingAssignment(assignment.id)
      close()
      setNotice({ tone: 'success', text: 'Teaching assignment removed.' })
      list.reload()
    } catch (error) {
      setDeleteError(errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<TeachingAssignmentRecord>[] = [
    {
      key: 'faculty',
      header: 'Faculty member',
      cell: (a) => (
        <>
          <span className="font-medium">{a.faculty.name}</span>
          <span className="block text-xs text-muted">{a.faculty.employee_id}</span>
        </>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      cell: (a) => (
        <>
          <span className="font-medium">{a.subject.code}</span>
          <span className="block text-xs text-muted">{a.subject.name}</span>
        </>
      ),
    },
    {
      key: 'section',
      header: 'Section',
      cell: (a) => (
        <>
          <span className="font-medium">{a.section.name}</span>
          <span className="block text-xs text-muted">
            {a.section.program}, sem {a.section.semester}, {a.section.academic_year}
          </span>
        </>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (a) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => setDialog({ kind: 'form', assignment: a })}>
            <Pencil className="size-4" aria-hidden="true" />
            <span className="sr-only">
              Change {a.subject.code} section {a.section.name} assignment
            </span>
          </Button>
          <Button size="sm" onClick={() => setDialog({ kind: 'delete', assignment: a })}>
            <Trash2 className="size-4" aria-hidden="true" />
            <span className="sr-only">
              Remove {a.faculty.name} from {a.subject.code} section {a.section.name}
            </span>
          </Button>
        </div>
      ),
    },
  ]

  const data = list.data
  const editing = dialog?.kind === 'form' ? dialog : null
  const removing = dialog?.kind === 'delete' ? dialog.assignment : null
  const formReady = options.data !== undefined

  return (
    <div className="space-y-6">
      <PageTitle
        title="Teaching assignments"
        subtitle="Which faculty member teaches which subject to which section."
        action={
          <Button variant="primary" disabled={!formReady} onClick={() => setDialog({ kind: 'form' })}>
            <Plus className="size-4" aria-hidden="true" />
            New assignment
          </Button>
        }
      />

      <StatusMessage notice={notice} />
      {options.error ? (
        <Card>
          <ErrorState message={errorMessage(options.error)} onRetry={options.reload} />
        </Card>
      ) : null}

      <Card>
        <div className="p-5 sm:max-w-md">
          <SelectField
            label="Filter by subject"
            value={subjectFilter}
            onChange={(next) => {
              setSubjectFilter(next)
              setPaging({ filter: next, page: 1 })
            }}
            options={subjectOptions}
          />
        </div>
        {list.error ? (
          <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
        ) : list.loading ? (
          <LoadingBlock label="Loading assignments…" rows={6} />
        ) : !data || data.count === 0 ? (
          <EmptyState
            title={subjectFilter ? 'Nobody teaches this subject yet' : 'No teaching assignments yet'}
            body="Assign a faculty member to a subject and section so they can take attendance and enter marks."
          />
        ) : (
          <>
            <DataTable caption="Teaching assignments" columns={columns} rows={data.items} rowKey={(a) => a.id} />
            <Pagination
              page={data.page}
              totalPages={data.total_pages}
              count={data.count}
              noun="assignment"
              busy={list.refreshing}
              onPage={(next) => setPaging({ filter: subjectFilter, page: next })}
            />
          </>
        )}
      </Card>

      <Modal
        open={editing !== null && formReady}
        onClose={close}
        title={editing?.assignment ? 'Change teaching assignment' : 'New teaching assignment'}
        description="The same faculty member can teach several subjects and sections."
      >
        {options.data && (
          <TeachingAssignmentForm
            assignment={editing?.assignment}
            faculty={options.data.faculty}
            subjects={options.data.subjects}
            sections={options.data.sections}
            onCancel={close}
            onSaved={() => {
              const created = !editing?.assignment
              close()
              setNotice({ tone: 'success', text: created ? 'Teaching assignment created.' : 'Teaching assignment updated.' })
              list.reload()
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title="Remove this teaching assignment?"
        confirmLabel="Remove assignment"
        busy={deleting}
        error={deleteError}
        onConfirm={() => removing && confirmDelete(removing)}
        onClose={close}
      >
        <p>
          <strong className="text-ink">
            {removing?.faculty.name} · {removing?.subject.code} · section {removing?.section.name}
          </strong>
        </p>
        <p className="mt-2">
          The faculty member loses access to this class. If attendance sessions or assessments already exist for it,
          the server will refuse the removal so no records are orphaned.
        </p>
      </ConfirmDialog>
    </div>
  )
}
