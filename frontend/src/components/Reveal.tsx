import type { ReactNode } from 'react'

import { useReveal } from '../hooks/useReveal'

interface Props {
  children: ReactNode
  /** Stagger in milliseconds. */
  delay?: number
  className?: string
}

/** Fades and rises 16px the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className }: Props) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} data-reveal="" style={delay ? { transitionDelay: `${delay}ms` } : undefined} className={className}>
      {children}
    </div>
  )
}
