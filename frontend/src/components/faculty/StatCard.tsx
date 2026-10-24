import type { LucideIcon } from 'lucide-react'

import { Card } from '../ui/Card'
import { Skeleton } from '../ui/States'

interface Props {
  title: string
  value: string
  caption?: string
  icon: LucideIcon
  loading?: boolean
}

export function StatCard({ title, value, caption, icon: Icon, loading }: Props) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{title}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <p className="mt-1 font-display text-3xl font-semibold text-ink">{value}</p>
          )}
          {caption && !loading && <p className="mt-1 text-sm text-muted">{caption}</p>}
        </div>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </Card>
  )
}
