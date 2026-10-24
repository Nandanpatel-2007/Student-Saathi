import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'
import type { Alert } from '../../lib/faculty-api'

type Tone = 'danger' | 'warning' | 'neutral' | 'accent'

const tones: Record<Tone, string> = {
  danger: 'bg-danger-bg text-danger-ink',
  warning: 'bg-warn-bg text-warn-ink',
  neutral: 'bg-surface-alt text-ink',
  accent: 'bg-accent-soft text-accent-text',
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  )
}

const ALERT_LABEL: Record<Alert['code'], string> = {
  LOW_ATTENDANCE: 'Low attendance',
  ATTENDANCE_WARNING: 'Attendance warning',
  FAILING_SUBJECT: 'Failing',
  SHARP_DROP: 'Score drop',
}

/** Short chip; the API's own message (with its thresholds) is available to screen readers and on hover. */
export function AlertChip({ alert }: { alert: Alert }) {
  return (
    <span title={alert.message}>
      <StatusBadge tone={alert.severity === 'critical' ? 'danger' : 'warning'}>
        {ALERT_LABEL[alert.code]}
        <span className="sr-only">: {alert.message}</span>
      </StatusBadge>
    </span>
  )
}

export function AlertChips({ alerts }: { alerts: readonly Alert[] }) {
  if (alerts.length === 0) return <span className="text-muted">—</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {alerts.map((alert) => (
        <AlertChip key={alert.code + (alert.subject_id ?? '')} alert={alert} />
      ))}
    </span>
  )
}
