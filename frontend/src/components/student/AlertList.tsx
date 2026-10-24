import { CircleAlert, TriangleAlert } from 'lucide-react'

import { cn } from '../../lib/cn'
import type { Alert } from '../../lib/schemas'
import { sortAlerts } from '../../lib/student-derive'
import { AlertChip } from '../faculty/StatusBadge'

interface Props {
  alerts: readonly Alert[]
  /** Limit how many to show (after sorting critical first). */
  limit?: number
}

/** Alerts as the API worded them, critical first. */
export function AlertList({ alerts, limit }: Props) {
  const sorted = sortAlerts(alerts)
  const shown = limit === undefined ? sorted : sorted.slice(0, limit)
  return (
    <ul className="divide-y divide-line">
      {shown.map((alert, index) => {
        const critical = alert.severity === 'critical'
        const Icon = critical ? CircleAlert : TriangleAlert
        return (
          <li key={`${alert.code}-${alert.subject_id ?? index}`} className="flex gap-3 px-5 py-4">
            <span
              className={cn(
                'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
                critical ? 'bg-danger-bg text-danger-ink' : 'bg-warn-bg text-warn-ink',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <AlertChip alert={alert} messageShown />
                {alert.subject_code && <span className="text-sm font-medium text-ink">{alert.subject_code}</span>}
              </div>
              <p className="mt-1.5 text-sm text-muted">{alert.message}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
