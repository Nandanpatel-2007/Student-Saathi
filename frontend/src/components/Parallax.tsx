import type { ReactNode } from 'react'

import { useParallax } from '../hooks/useParallax'
import { cn } from '../lib/cn'

interface Props {
  speed: number
  mode?: 'scroll' | 'center'
  className?: string
  children?: ReactNode
  /** Hide from assistive tech (decorative layers). */
  decorative?: boolean
}

/** Wrapper that applies the parallax transform to its own box. */
export function Parallax({ speed, mode, className, children, decorative }: Props) {
  const ref = useParallax<HTMLDivElement>(speed, mode)
  return (
    <div ref={ref} aria-hidden={decorative || undefined} className={cn('will-change-transform', className)}>
      {children}
    </div>
  )
}
