import { LogOut } from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { useLogout } from '../auth/useLogout'
import { ROLE_LABEL } from '../auth/utils'
import { roleHome } from '../content/auth'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { Role } from '../types/auth'
import { Container } from './Container'
import { Wordmark } from './Logo'
import { ThemeToggle } from './ThemeToggle'

/** Shared shell for the placeholder homes (/student, /admin): top bar plus an empty-state card. */
export function RoleHomeLayout({ role }: { role: Role }) {
  const { user } = useAuth()
  const onLogout = useLogout()
  const { title, body, icon: Icon } = roleHome[role]
  useDocumentTitle(`${ROLE_LABEL[role]} | Student Saathi`)

  return (
    <div className="min-h-svh">
      <header className="border-b border-line bg-canvas">
        <Container className="flex h-16 items-center justify-between gap-3">
          <Wordmark name="Student Saathi" className="shrink-0" />
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[12rem] truncate text-sm font-medium text-ink sm:block">{user?.name}</span>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium tracking-wide text-accent-text">
              {ROLE_LABEL[role]}
            </span>
            <ThemeToggle />
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-alt"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
              <span className="sr-only sm:hidden">Log out</span>
            </button>
          </div>
        </Container>
      </header>

      <main>
        <Container className="py-12 sm:py-20">
          <p className="mb-6 text-sm text-muted sm:hidden">Signed in as {user?.name}</p>
          <section
            aria-labelledby="role-home-heading"
            className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center"
          >
            <span className="inline-flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <h1 id="role-home-heading" className="mt-6 text-2xl font-semibold text-ink sm:text-3xl">
              {title}
            </h1>
            <p className="mt-3 max-w-sm text-muted">{body}</p>
          </section>
        </Container>
      </main>
    </div>
  )
}
