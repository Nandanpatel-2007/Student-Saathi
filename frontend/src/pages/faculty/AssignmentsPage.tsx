import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { AssignmentForm } from '../../components/assignments/AssignmentForm'
import { ClassPicker } from '../../components/faculty/ClassPicker'
import { DataTable, type Column } from '../../components/faculty/DataTable'
import { PageTitle } from '../../components/faculty/PageTitle'
import { StatusBadge } from '../../components/faculty/StatusBadge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { StatusMessage, type Notice } from '../../components/ui/StatusMessage'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useSelectedClass } from '../../hooks/useSelectedClass'
import { deleteAssignment, listAssignments, type AssignmentRecord } from '../../lib/assignments-api'
import { errorMessage, formatNumber } from '../../lib/format'
import { formatDue } from '../../lib/timing'

type Dialog = { kind: 'form'; assignment?: AssignmentRecord } | { kind: 'delete'; assignment: AssignmentRecord } | null

export function AssignmentsPage() {
  const { classes, selected, value, setClass } = useSelectedClass({ allowAll: false })
  const list = useAsyncData(selected ? `assignments:${selected.assignment_id}` : null, () =>
    selected ? listAssignments(selected.assignment_id) : Promise.resolve([]),
  )
  const [dialog, setDialog] = useState<Dialog>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const close = () => {
    setDialog(null)
    setDeleteError(null)
  }

  const confirmDelete = async (assignment: AssignmentRecord) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAssignment(assignment.id)
      close()
      setNotice({ tone: 'success', text: `Deleted “${assignment.title}”.` })
      list.reload()
    } catch (error) {
      setDeleteError(errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<AssignmentRecord>[] = [
    {
      key: 'title',
      header: 'Assignment',
      cell: (a) => (
        <Link to={`/faculty/assignments/${a.id}`} className="font-medium text-accent-text underline-offset-4 hover:underline">
          {a.title}
        </Link>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      cell: (a) => (
        <span className="text-sm">
          {formatDue(a.due_at)}
          {!a.allow_late_submissions && <span className="block text-xs text-muted">No late submissions</span>}
        </span>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      align: 'right',
      cell: (a) => (
        <span className="tabular-nums">
          {a.submitted_count} / {a.total_students}
        </span>
      ),
    },
    {
      key: 'late',
      header: 'Late',
      align: 'right',
      cell: (a) =>
        a.late_count > 0 ? <StatusBadge tone="warning">{a.late_count} late</StatusBadge> : <span className="text-muted">0</span>,
    },
    {
      key: 'graded',
      header: 'Graded',
      align: 'right',
      cell: (a) => (
        <span className="tabular-nums">
          {a.graded_count} / {a.submitted_count}
        </span>
      ),
    },
    {
      key: 'max',
      header: 'Max',
      align: 'right',
      cell: (a) => <span className="tabular-nums">{formatNumber(a.max_marks, 2)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (a) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            to={`/faculty/assignments/${a.id}`}
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-alt"
          >
            Submissions
            <span className="sr-only"> for {a.title}</span>
          </Link>
          <Button size="sm" onClick={() => setDialog({ kind: 'form', assignment: a })}>
            <Pencil className="size-4" aria-hidden="true" />
            <span className="sr-only">Edit {a.title}</span>
          </Button>
          <Button size="sm" onClick={() => setDialog({ kind: 'delete', assignment: a })}>
            <Trash2 className="size-4" aria-hidden="true" />
            <span className="sr-only">Delete {a.title}</span>
          </Button>
        </div>
      ),
    },
  ]

  const assignments = list.data ?? []
  const editing = dialog?.kind === 'form' ? dialog : null
  const removing = dialog?.kind === 'delete' ? dialog.assignment : null

  return (
    <div className="space-y-6">
      <PageTitle
        title="Assignments"
        subtitle="Post work to a class, see who has submitted and when, and grade it."
        action={
          <Button variant="primary" disabled={!selected} onClick={() => setDialog({ kind: 'form' })}>
            <Plus className="size-4" aria-hidden="true" />
            New assignment
          </Button>
        }
      />

      <Card>
        <div className="p-5 sm:max-w-md">
          <ClassPicker classes={classes} value={value} onChange={setClass} />
        </div>
      </Card>

      <StatusMessage notice={notice} />

      <Card>
        {list.error ? (
          <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
        ) : list.loading ? (
          <LoadingBlock label="Loading assignments…" rows={4} />
        ) : assignments.length === 0 ? (
          <EmptyState
            title="No assignments yet"
            body="Post the first one and students in this class will see it straight away."
            action={
              <Button variant="primary" onClick={() => setDialog({ kind: 'form' })}>
                <Plus className="size-4" aria-hidden="true" />
                New assignment
              </Button>
            }
          />
        ) : (
          <DataTable caption="Assignments for the selected class" columns={columns} rows={assignments} rowKey={(a) => a.id} />
        )}
      </Card>

      <Modal
        open={editing !== null && selected !== null}
        onClose={close}
        title={editing?.assignment ? 'Edit assignment' : 'New assignment'}
        description={selected ? `${selected.subject.code} · section ${selected.section.name}` : undefined}
      >
        {selected && (
          <AssignmentForm
            teachingAssignmentId={selected.assignment_id}
            assignment={editing?.assignment}
            onCancel={close}
            onSaved={(saved) => {
              const created = !editing?.assignment
              close()
              setNotice({ tone: 'success', text: `${created ? 'Posted' : 'Updated'} “${saved.title}”.` })
              list.reload()
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Delete “${removing.title}”?` : 'Delete assignment?'}
        confirmLabel="Delete assignment"
        busy={deleting}
        error={deleteError}
        onConfirm={() => removing && confirmDelete(removing)}
        onClose={close}
      >
        <p>
          This removes the assignment
          {removing && removing.submitted_count > 0
            ? `, ${removing.submitted_count} submission${removing.submitted_count === 1 ? '' : 's'} and their uploaded files`
            : ''}
          . Marks already given for it stop counting towards students’ averages. This can’t be undone.
        </p>
      </ConfirmDialog>
    </div>
  )
}
