import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { useLogout } from '../../auth/useLogout'
import { Wordmark } from '../../components/Logo'
import { ThemeToggle } from '../../components/ThemeToggle'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import type { FacultyOutletContext } from '../../hooks/useFacultyContext'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { cn } from '../../lib/cn'
import { listMyClasses } from '../../lib/faculty-api'
import { errorMessage } from '../../lib/format'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV: readonly NavItem[] = [
  { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/faculty/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/faculty/assessments', label: 'Assessments', icon: ClipboardCheck },
  { to: '/faculty/students', label: 'Students', icon: Users },
  { to: '/faculty/subjects', label: 'Subjects', icon: BookOpen },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?'
}

export function FacultyLayout() {
  const { user } = useAuth()
  const logout = useLogout()
  const location = useLocation()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const classes = useAsyncData('faculty-classes', listMyClasses)

  const current = NAV.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))
  useDocumentTitle(`${current?.label ?? 'Faculty'} | Student Saathi`)

  const closeDrawer = () => {
    setOpen(false)
    menuButton.current?.focus()
  }
  const openDrawer = () => {
    setOpen(true)
    // The drawer becomes focusable on the next paint.
    requestAnimationFrame(() => closeButton.current?.focus())
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const name = user?.name ?? 'Faculty'
  const context: FacultyOutletContext = { classes: classes.data ?? [] }

  return (
    <div className="min-h-svh bg-canvas">
      <a
        href="#faculty-main"
        className="sr-only z-[60] rounded-lg bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {open && !isDesktop && (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={closeDrawer}
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
        />
      )}

      <aside
        inert={!isDesktop && !open}
        aria-label="Faculty navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <Wordmark name="Student Saathi" />
          <button
            ref={closeButton}
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-alt hover:text-ink lg:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 pt-5">
          <div className="flex items-center gap-3 rounded-xl bg-surface-alt p-3">
            <span
              aria-hidden="true"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent"
            >
              {initials(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              <p className="text-xs text-muted">Faculty</p>
            </div>
          </div>
        </div>

        <nav aria-label="Faculty sections" className="mt-6 flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-alt hover:text-ink',
                )
              }
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={logout}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-alt hover:text-ink"
          >
            <LogOut className="size-[18px]" aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button
            ref={menuButton}
            type="button"
            onClick={openDrawer}
            aria-label="Open menu"
            aria-expanded={open}
            className="inline-flex size-10 items-center justify-center rounded-lg text-ink hover:bg-surface-alt lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <p className="text-sm text-muted">
            Faculty <span aria-hidden="true">/</span> <span className="font-medium text-ink">{current?.label}</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-[14rem] truncate text-sm font-medium text-ink sm:block">{name}</span>
            <ThemeToggle />
          </div>
        </header>

        <main id="faculty-main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {classes.loading ? (
            <div role="status" aria-busy="true" className="space-y-4">
              <span className="sr-only">Loading your classes…</span>
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : classes.error ? (
            <ErrorState message={errorMessage(classes.error)} onRetry={classes.reload} />
          ) : context.classes.length === 0 ? (
            <EmptyState
              title="No classes assigned yet"
              body="Once an admin assigns you a subject and section, your classes will appear here."
            />
          ) : (
            <Outlet context={context} />
          )}
        </main>
      </div>
    </div>
  )
}
