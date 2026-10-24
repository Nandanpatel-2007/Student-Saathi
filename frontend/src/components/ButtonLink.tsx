import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse'
type Size = 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-alt',
  ghost: 'text-ink hover:bg-surface-alt',
  inverse: 'bg-band-btn text-band-btn-ink hover:opacity-90',
}

const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

interface Props {
  /** Client-side route. */
  to?: string
  /** Plain anchor (hash links, external). */
  href?: string
  variant?: Variant
  size?: Size
  className?: string
  onClick?: () => void
  children: ReactNode
}

export function ButtonLink({ to, href, variant = 'primary', size = 'md', className, onClick, children }: Props) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors',
    variants[variant],
    sizes[size],
    className,
  )
  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} className={classes} onClick={onClick}>
      {children}
    </a>
  )
}
