import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AssessmentForm } from '../../components/faculty/AssessmentForm'
import { ClassPicker } from '../../components/faculty/ClassPicker'
import { DataTable, type Column } from '../../components/faculty/DataTable'
import { MarksSheet } from '../../components/faculty/MarksSheet'
import { PageTitle } from '../../components/faculty/PageTitle'
import { StatusBadge } from '../../components/faculty/StatusBadge'
import { WeightageMeter } from '../../components/faculty/WeightageMeter'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { StatusMessage, type Notice } from '../../components/ui/StatusMessage'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useSelectedClass } from '../../hooks/useSelectedClass'
import { deleteAssessment, listAssessments, type Assessment } from '../../lib/faculty-api'
import { errorMessage, formatDate, formatNumber } from '../../lib/format'
import { weightageUsed } from '../../lib/marks'

type FormState = { mode: 'create' } | { mode: 'edit'; assessment: Assessment } | null

const TYPE_LABEL: Record<Assessment['type'], string> = {
  QUIZ: 'Quiz',
  MIDTERM: 'Midterm',
  ASSIGNMENT: 'Assignment',
  PRACTICAL: 'Practical',
  OTHER: 'Other',
}

export function AssessmentsPage() {
  const { classes, selected, value, setClass } = useSelectedClass({ allowAll: false })
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState<FormState>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const list = useAsyncData(selected ? `assessments:${selected.assignment_id}` : null, () =>
    selected ? listAssessments(selected.assignment_id) : Promise.resolve([]),
  )
  const assessments = list.data ?? []
  const used = weightageUsed(assessments)

  const marksFor = Number(params.get('assessment'))
  const activeAssessment = assessments.find((a) => a.id === marksFor)

  const selectForMarks = (id: number | null) => {
    setParams(
      (prev) => {
        const copy = new URLSearchParams(prev)
        if (id === null) copy.delete('assessment')
        else copy.set('assessment', String(id))
        return copy
      },
      { replace: true },
    )
  }

  const changeClass = (next: string) => {
    setForm(null)
    setConfirmDeleteId(null)
    setNotice(null)
    setClass(next)
  }

  const remove = async (assessment: Assessment) => {
    setDeletingId(assessment.id)
    setNotice(null)
    try {
      await deleteAssessment(assessment.id)
      if (activeAssessment?.id === assessment.id) selectForMarks(null)
      setNotice({ tone: 'success', text: `Deleted “${assessment.title}”.` })
      list.reload()
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const columns: Column<Assessment>[] = [
    { key: 'title', header: 'Title', cell: (a) => <span className="font-medium">{a.title}</span> },
    { key: 'type', header: 'Type', cell: (a) => <StatusBadge>{TYPE_LABEL[a.type]}</StatusBadge> },
    { key: 'date', header: 'Date', cell: (a) => <span className="whitespace-nowrap">{formatDate(a.date)}</span> },
    { key: 'max', header: 'Max', align: 'right', cell: (a) => <span className="tabular-nums">{formatNumber(a.max_marks, 2)}</span> },
    {
      key: 'weight',
      header: 'Weightage',
      align: 'right',
      cell: (a) => <span className="tabular-nums">{formatNumber(a.weightage_percent, 2)}%</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (a) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant={a.id === marksFor ? 'primary' : 'secondary'} onClick={() => selectForMarks(a.id)}>
            Enter marks
            <span className="sr-only"> for {a.title}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setNotice(null)
              setForm({ mode: 'edit', assessment: a })
            }}
          >
            <Pencil className="size-4" aria-hidden="true" />
            <span className="sr-only">Edit {a.title}</span>
          </Button>
          {confirmDeleteId === a.id ? (
            <>
              <Button size="sm" variant="danger" loading={deletingId === a.id} onClick={() => remove(a)}>
                Confirm delete
                <span className="sr-only"> {a.title} and its marks</span>
              </Button>
              <Button size="sm" onClick={() => setConfirmDeleteId(null)} disabled={deletingId === a.id}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setConfirmDeleteId(a.id)}>
              <Trash2 className="size-4" aria-hidden="true" />
              <span className="sr-only">Delete {a.title}</span>
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageTitle
        title="Assessments and marks"
        subtitle="Create assessments for a class, then enter marks."
        action={
          <Button
            variant="primary"
            disabled={!selected}
            onClick={() => {
              setNotice(null)
              setForm({ mode: 'create' })
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            New assessment
          </Button>
        }
      />

      <Card>
        <div className="grid gap-5 p-5 lg:grid-cols-2 lg:items-end">
          <ClassPicker classes={classes} value={value} onChange={changeClass} />
          <WeightageMeter used={used} />
        </div>
      </Card>

      <StatusMessage notice={notice} />

      {form && selected && (
        <AssessmentForm
          key={form.mode === 'edit' ? form.assessment.id : 'new'}
          assignmentId={selected.assignment_id}
          assessment={form.mode === 'edit' ? form.assessment : undefined}
          usedElsewhere={weightageUsed(assessments, form.mode === 'edit' ? form.assessment.id : undefined)}
          onCancel={() => setForm(null)}
          onSaved={(saved) => {
            const created = form.mode === 'create'
            setForm(null)
            setNotice({ tone: 'success', text: `${created ? 'Created' : 'Updated'} “${saved.title}”.` })
            list.reload()
            if (created) selectForMarks(saved.id)
          }}
        />
      )}

      <Card>
        <CardHeader title="Assessments" subtitle={selected ? `${selected.subject.name} · ${selected.section.name}` : undefined} />
        {list.error ? (
          <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
        ) : list.loading ? (
          <LoadingBlock label="Loading assessments…" rows={4} />
        ) : assessments.length === 0 ? (
          <EmptyState
            title="No assessments yet"
            body="Create the first one to start recording marks."
            action={
              <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
                <Plus className="size-4" aria-hidden="true" />
                New assessment
              </Button>
            }
          />
        ) : (
          <DataTable
            caption="Assessments for the selected class"
            columns={columns}
            rows={assessments}
            rowKey={(a) => a.id}
            rowClassName={(a) => (a.id === marksFor ? 'bg-accent-soft/40' : undefined)}
          />
        )}
      </Card>

      {activeAssessment ? (
        <section aria-labelledby="marks-heading" className="space-y-3">
          <h2 id="marks-heading" className="text-xl font-semibold text-ink">
            Marks · {activeAssessment.title}
          </h2>
          <MarksSheet assessmentId={activeAssessment.id} />
        </section>
      ) : (
        assessments.length > 0 && (
          <p className="text-center text-sm text-muted">Choose “Enter marks” on an assessment to open its marks sheet.</p>
        )
      )}
    </div>
  )
}
