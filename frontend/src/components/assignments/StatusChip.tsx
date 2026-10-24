import { AlarmClock, BadgeCheck, CircleAlert, CircleCheck, Clock, type LucideIcon } from 'lucide-react'

import type { SubmissionStatus } from '../../lib/assignments-api'
import { StatusBadge } from '../faculty/StatusBadge'

type Tone = 'danger' | 'warning' | 'neutral' | 'accent'

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  NOT_SUBMITTED: 'Not submitted',
  SUBMITTED: 'Submitted',
  LATE: 'Late',
  GRADED: 'Graded',
  OVERDUE_MISSING: 'Missing',
}

const CONFIG: Record<SubmissionStatus, { icon: LucideIcon; tone: Tone }> = {
  NOT_SUBMITTED: { icon: Clock, tone: 'neutral' },
  SUBMITTED: { icon: CircleCheck, tone: 'accent' },
  LATE: { icon: AlarmClock, tone: 'warning' },
  GRADED: { icon: BadgeCheck, tone: 'accent' },
  OVERDUE_MISSING: { icon: CircleAlert, tone: 'danger' },
}

/** A status as icon + text, so it never relies on colour alone. */
export function StatusChip({ status }: { status: SubmissionStatus }) {
  const { icon: Icon, tone } = CONFIG[status]
  return (
    <StatusBadge tone={tone}>
      <Icon className="mr-1 size-3.5" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </StatusBadge>
  )
}
