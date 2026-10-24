import { useRef, useState, type KeyboardEvent } from 'react'

import { StudentAssignmentCard } from '../../components/assignments/StudentAssignmentCard'
import { PageTitle } from '../../components/faculty/PageTitle'
import { Card } from '../../components/ui/Card'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import { listMyAssignments, type StudentAssignment } from '../../lib/assignments-api'
import { TAB_LABEL, TAB_ORDER, countByTab, itemsForTab, type AssignmentTab } from '../../lib/assignments-derive'
import { cn } from '../../lib/cn'
import { errorMessage } from '../../lib/format'

const EMPTY: Record<AssignmentTab, { title: string; body: string }> = {
  upcoming: { title: 'Nothing due', body: 'You have no open assignments right now.' },
  submitted: { title: 'Nothing submitted yet', body: 'Work you hand in appears here until it is graded.' },
  graded: { title: 'Nothing graded yet', body: 'Marks and feedback appear here once your teacher grades your work.' },
  overdue: { title: 'Nothing overdue', body: 'You have no missed deadlines.' },
}

export function AssignmentsPage() {
  const list = useAsyncData('my-assignments', listMyAssignments)
  const [tab, setTab] = useState<AssignmentTab>('upcoming')
  // Items changed locally (after a submit) show immediately, without waiting for a reload.
  const [patched, setPatched] = useState<Record<number, StudentAssignment>>({})
  const tabRefs = useRef<Record<AssignmentTab, HTMLButtonElement | null>>({
    upcoming: null,
    submitted: null,
    graded: null,
    overdue: null,
  })

  const items = (list.data ?? []).map((item) => patched[item.assignment_id] ?? item)
  const counts = countByTab(items)
  const visible = itemsForTab(items, tab)

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = TAB_ORDER[(index + step + TAB_ORDER.length) % TAB_ORDER.length]
    if (next) {
      setTab(next)
      tabRefs.current[next]?.focus()
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Assignments" subtitle="Hand in your work, and see your marks and feedback." />

      <div role="tablist" aria-label="Assignment status" className="flex flex-wrap gap-2">
        {TAB_ORDER.map((id, index) => {
          const active = tab === id
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={active}
              aria-controls="assignment-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors',
                active
                  ? 'border-accent bg-accent-soft text-accent-text'
                  : 'border-line bg-surface text-ink hover:bg-surface-alt',
              )}
            >
              {TAB_LABEL[id]}
              <span className="text-xs tabular-nums text-muted">{counts[id]}</span>
            </button>
          )
        })}
      </div>

      <div id="assignment-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-4">
        {list.error ? (
          <Card>
            <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
          </Card>
        ) : list.loading ? (
          <Card>
            <LoadingBlock label="Loading your assignments…" rows={4} />
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState title={EMPTY[tab].title} body={EMPTY[tab].body} />
          </Card>
        ) : (
          visible.map((item) => (
            <StudentAssignmentCard
              key={item.assignment_id}
              item={item}
              onChanged={(updated) => setPatched((prev) => ({ ...prev, [updated.assignment_id]: updated }))}
              onWithdrawn={() => {
                setPatched({})
                list.reload()
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
