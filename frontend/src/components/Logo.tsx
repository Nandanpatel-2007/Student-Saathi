import { cn } from '../lib/cn'

/** Geometric mark: three rising bars in a rounded square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7 shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <rect x="7" y="17" width="4.5" height="8" rx="1" className="fill-on-accent" />
      <rect x="13.75" y="12" width="4.5" height="13" rx="1" className="fill-on-accent" />
      <rect x="20.5" y="7" width="4.5" height="18" rx="1" className="fill-on-accent" />
    </svg>
  )
}

export function Wordmark({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-display text-lg font-semibold tracking-tight text-ink">{name}</span>
    </span>
  )
}
