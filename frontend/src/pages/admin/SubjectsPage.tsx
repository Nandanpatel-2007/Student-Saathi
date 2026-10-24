import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { SubjectForm } from '../../components/admin/SubjectForm'
import { DataTable, type Column } from '../../components/faculty/DataTable'
import { PageTitle } from '../../components/faculty/PageTitle'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { SearchField } from '../../components/ui/SearchField'
import { StatusMessage, type Notice } from '../../components/ui/StatusMessage'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useSearchPaging } from '../../hooks/useSearchPaging'
import { deleteSubject, listSubjectsPage, type SubjectRecord } from '../../lib/admin-api'
import { errorMessage } from '../../lib/format'

type Dialog = { kind: 'form'; subject?: SubjectRecord } | { kind: 'delete'; subject: SubjectRecord } | null

export function SubjectsPage() {
  const { search, setSearch, term, page, setPage } = useSearchPaging()
  const list = useAsyncData(`admin-subjects:${term}:${page}`, () => listSubjectsPage({ page, search: term }))
  const [dialog, setDialog] = useState<Dialog>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const close = () => {
    setDialog(null)
    setDeleteError(null)
  }

  const confirmDelete = async (subject: SubjectRecord) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteSubject(subject.id)
      close()
      setNotice({ tone: 'success', text: `Deleted ${subject.code}.` })
      list.reload()
    } catch (error) {
      setDeleteError(errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<SubjectRecord>[] = [
    { key: 'code', header: 'Code', cell: (s) => <span className="font-medium whitespace-nowrap">{s.code}</span> },
    { key: 'name', header: 'Name', cell: (s) => s.name },
    { key: 'credits', header: 'Credits', align: 'right', cell: (s) => <span className="tabular-nums">{s.credits}</span> },
    { key: 'semester', header: 'Semester', align: 'right', cell: (s) => <span className="tabular-nums">{s.semester}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (s) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => setDialog({ kind: 'form', subject: s })}>
            <Pencil className="size-4" aria-hidden="true" />
            <span className="sr-only">Edit {s.code}</span>
          </Button>
          <Button size="sm" onClick={() => setDialog({ kind: 'delete', subject: s })}>
            <Trash2 className="size-4" aria-hidden="true" />
            <span className="sr-only">Delete {s.code}</span>
          </Button>
        </div>
      ),
    },
  ]

  const data = list.data
  const editing = dialog?.kind === 'form' ? dialog : null
  const removing = dialog?.kind === 'delete' ? dialog.subject : null

  return (
    <div className="space-y-6">
      <PageTitle
        title="Subjects"
        subtitle="The subjects that can be taught and enrolled in."
        action={
          <Button variant="primary" onClick={() => setDialog({ kind: 'form' })}>
            <Plus className="size-4" aria-hidden="true" />
            New subject
          </Button>
        }
      />

      <StatusMessage notice={notice} />

      <Card>
        <div className="p-5 sm:max-w-md">
          <SearchField label="Search subjects" value={search} onChange={setSearch} placeholder="Code or name" />
        </div>
        {list.error ? (
          <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
        ) : list.loading ? (
          <LoadingBlock label="Loading subjects…" rows={6} />
        ) : !data || data.count === 0 ? (
          <EmptyState
            title={term ? 'No subjects match your search' : 'No subjects yet'}
            body={term ? 'Try a different code or name.' : 'Create the first subject to get started.'}
          />
        ) : (
          <>
            <DataTable caption="Subjects" columns={columns} rows={data.items} rowKey={(s) => s.id} />
            <Pagination page={data.page} totalPages={data.total_pages} count={data.count} noun="subject" busy={list.refreshing} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={close}
        title={editing?.subject ? `Edit ${editing.subject.code}` : 'New subject'}
        description="Subject codes must be unique."
      >
        <SubjectForm
          subject={editing?.subject}
          onCancel={close}
          onSaved={(saved) => {
            const created = !editing?.subject
            close()
            setNotice({ tone: 'success', text: `${created ? 'Created' : 'Updated'} ${saved.code}.` })
            list.reload()
          }}
        />
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Delete ${removing.code}?` : 'Delete subject?'}
        confirmLabel="Delete subject"
        busy={deleting}
        error={deleteError}
        onConfirm={() => removing && confirmDelete(removing)}
        onClose={close}
      >
        <p>
          <strong className="text-ink">
            {removing?.code} · {removing?.name}
          </strong>{' '}
          will be removed permanently.
        </p>
        <p className="mt-2">
          A subject that still has enrollments or a faculty member teaching it can’t be deleted; remove those first
          under Enrollments and Teaching assignments.
        </p>
      </ConfirmDialog>
    </div>
  )
}
