import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Container } from '../components/Container'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function NotFound() {
  useDocumentTitle('Page not found | Student Saathi')
  return (
    <main className="flex min-h-svh items-center">
      <Container className="py-16 text-center">
        <p className="font-display text-6xl font-semibold text-accent-text">404</p>
        <h1 className="mt-4 text-3xl font-semibold text-ink sm:text-4xl">Page not found</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">The page you’re looking for doesn’t exist or has moved.</p>
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
