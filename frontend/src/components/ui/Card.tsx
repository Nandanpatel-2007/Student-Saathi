import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-line bg-surface', className)}>{children}</div>
}

interface CardHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  /** Heading level to render the title with (default h2). */
  as?: 'h2' | 'h3'
}

export function CardHeader({ title, subtitle, action, as: Heading = 'h2' }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <Heading className="text-base font-semibold text-ink">{title}</Heading>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
