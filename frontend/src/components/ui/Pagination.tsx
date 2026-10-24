import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from './Button'

interface Props {
  page: number
  totalPages: number
  count: number
  /** Singular noun for the summary, e.g. "student". */
  noun: string
  busy?: boolean
  onPage: (page: number) => void
}

export function Pagination({ page, totalPages, count, noun, busy, onPage }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
      <p className="text-sm text-muted" aria-live="polite">
        Page {page} of {Math.max(totalPages, 1)} · {count} {noun}
        {count === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1 || busy}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Button>
        <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages || busy}>
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
