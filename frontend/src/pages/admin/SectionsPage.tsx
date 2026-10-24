import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { SectionForm } from '../../components/admin/SectionForm'
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
import { deleteSection, listSectionsPage, type SectionRecord } from '../../lib/admin-api'
import { errorMessage } from '../../lib/format'

type Dialog = { kind: 'form'; section?: SectionRecord } | { kind: 'delete'; section: SectionRecord } | null

const label = (s: SectionRecord) => `${s.program}, semester ${s.semester}, section ${s.name} (${s.academic_year})`

export function SectionsPage() {
  const { search, setSearch, term, page, setPage } = useSearchPaging()
  const list = useAsyncData(`admin-sections:${term}:${page}`, () => listSectionsPage({ page, search: term }))
  const [dialog, setDialog] = useState<Dialog>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const close = () => {
    setDialog(null)
    setDeleteError(null)
  }

  const confirmDelete = async (section: SectionRecord) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteSection(section.id)
      close()
      setNotice({ tone: 'success', text: `Deleted section ${section.name}.` })
      list.reload()
    } catch (error) {
      setDeleteError(errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<SectionRecord>[] = [
    { key: 'name', header: 'Section', cell: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'program', header: 'Programme', cell: (s) => s.program },
    { key: 'semester', header: 'Semester', align: 'right', cell: (s) => <span className="tabular-nums">{s.semester}</span> },
    { key: 'year', header: 'Academic year', cell: (s) => <span className="whitespace-nowrap">{s.academic_year}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (s) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => setDialog({ kind: 'form', section: s })}>
            <Pencil className="size-4" aria-hidden="true" />
            <span className="sr-only">Edit section {s.name}</span>
          </Button>
          <Button size="sm" onClick={() => setDialog({ kind: 'delete', section: s })}>
            <Trash2 className="size-4" aria-hidden="true" />
            <span className="sr-only">Delete section {s.name}</span>
          </Button>
        </div>
      ),
    },
  ]

  const data = list.data
  const editing = dialog?.kind === 'form' ? dialog : null
  const removing = dialog?.kind === 'delete' ? dialog.section : null

  return (
    <div className="space-y-6">
      <PageTitle
        title="Sections"
        subtitle="Class sections by programme, semester and academic year."
        action={
          <Button variant="primary" onClick={() => setDialog({ kind: 'form' })}>
            <Plus className="size-4" aria-hidden="true" />
            New section
          </Button>
        }
      />

      <StatusMessage notice={notice} />

      <Card>
        <div className="p-5 sm:max-w-md">
          <SearchField label="Search sections" value={search} onChange={setSearch} placeholder="Name or programme" />
        </div>
        {list.error ? (
          <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
        ) : list.loading ? (
          <LoadingBlock label="Loading sections…" rows={6} />
        ) : !data || data.count === 0 ? (
          <EmptyState
            title={term ? 'No sections match your search' : 'No sections yet'}
            body={term ? 'Try a different name or programme.' : 'Create the first section to get started.'}
          />
        ) : (
          <>
            <DataTable caption="Sections" columns={columns} rows={data.items} rowKey={(s) => s.id} />
            <Pagination page={data.page} totalPages={data.total_pages} count={data.count} noun="section" busy={list.refreshing} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={close}
        title={editing?.section ? `Edit section ${editing.section.name}` : 'New section'}
        description="The same name can be reused for a different programme, semester or year."
      >
        <SectionForm
          section={editing?.section}
          onCancel={close}
          onSaved={(saved) => {
            const created = !editing?.section
            close()
            setNotice({ tone: 'success', text: `${created ? 'Created' : 'Updated'} section ${saved.name}.` })
            list.reload()
          }}
        />
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Delete section ${removing.name}?` : 'Delete section?'}
        confirmLabel="Delete section"
        busy={deleting}
        error={deleteError}
        onConfirm={() => removing && confirmDelete(removing)}
        onClose={close}
      >
        <p>
          <strong className="text-ink">{removing && label(removing)}</strong> will be removed permanently.
        </p>
        <p className="mt-2">
          A section that still has students or teaching assignments can’t be deleted; move the students and remove
          the assignments first.
        </p>
      </ConfirmDialog>
    </div>
  )
}
