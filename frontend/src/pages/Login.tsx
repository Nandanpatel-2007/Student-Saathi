import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Container } from '../components/Container'
import { LogoMark } from '../components/Logo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/** Placeholder so the landing-page CTAs have somewhere to go. */
export function Login() {
  useDocumentTitle('Log in | Student Saathi')
  return (
    <main className="flex min-h-svh items-center">
      <Container className="py-16 text-center">
        <LogoMark className="mx-auto mb-6 size-10" />
        <h1 className="text-3xl font-semibold text-ink sm:text-4xl">Login coming soon</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Sign-in isn’t available yet. Check back shortly.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-alt"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to home
        </Link>
      </Container>
    </main>
  )
}
