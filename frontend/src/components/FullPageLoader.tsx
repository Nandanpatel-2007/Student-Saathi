import { LoaderCircle } from 'lucide-react'

/** Neutral full-page loader shown while the session is being restored. */
export function FullPageLoader() {
  return (
    <div role="status" className="flex min-h-svh items-center justify-center">
      <LoaderCircle className="size-8 animate-spin text-accent-text" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
