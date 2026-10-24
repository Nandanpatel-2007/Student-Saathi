import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { landing } from '../content/landing'
import { useScrolled } from '../hooks/useScrolled'
import { cn } from '../lib/cn'
import { ButtonLink } from './ButtonLink'
import { Container } from './Container'
import { Wordmark } from './Logo'
import { ThemeToggle } from './ThemeToggle'

const MENU_ID = 'mobile-menu'

export function Navbar() {
  const { brand, nav } = landing
  const scrolled = useScrolled()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-200',
        scrolled || open ? 'border-line bg-canvas/80 backdrop-blur-md' : 'border-transparent bg-transparent',
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <a href="#top" aria-label={`${brand} home`} className="rounded-md">
          <Wordmark name={brand} />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <ButtonLink to="/login" variant="ghost" className="hidden md:inline-flex">
            {nav.login}
          </ButtonLink>
          <ButtonLink to="/login" className="hidden sm:inline-flex">
            {nav.getStarted}
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={MENU_ID}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex size-10 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface-alt md:hidden"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </Container>

      <div id={MENU_ID} hidden={!open} className="border-t border-line md:hidden">
        <Container className="flex flex-col gap-1 py-3">
          {nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={close}
              className="rounded-md px-3 py-3 text-base font-medium text-ink hover:bg-surface-alt"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ButtonLink to="/login" variant="secondary" className="h-11" onClick={close}>
              {nav.login}
            </ButtonLink>
            <ButtonLink to="/login" className="h-11" onClick={close}>
              {nav.getStarted}
            </ButtonLink>
          </div>
        </Container>
      </div>
    </header>
  )
}
