import { formatPercent } from '../../lib/format'
import type { AtRiskStudent } from '../../lib/faculty-api'
import { AlertChip } from './StatusBadge'

export interface AtRiskItem extends AtRiskStudent {
  /** Which class the flag comes from (shown when several classes are combined). */
  classLabel?: string
}

export function AtRiskList({ items }: { items: readonly AtRiskItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item, index) => (
        <li key={`${item.student.id}-${item.classLabel ?? ''}-${index}`} className="px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-medium text-ink">
              {item.student.name} <span className="font-normal text-muted">· {item.student.roll_no}</span>
            </p>
            <p className="text-sm text-muted">
              Attendance {formatPercent(item.attendance_pct)} · Score {formatPercent(item.weighted_score)}
            </p>
          </div>
          {item.classLabel && <p className="mt-0.5 text-sm text-muted">{item.classLabel}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.alerts.map((alert) => (
              <AlertChip key={alert.code} alert={alert} messageShown />
            ))}
          </div>
          <ul className="mt-2 space-y-0.5 text-sm text-muted">
            {item.alerts.map((alert) => (
              <li key={alert.code}>{alert.message}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
