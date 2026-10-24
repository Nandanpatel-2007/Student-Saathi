import { landing } from '../content/landing'
import { Container } from './Container'
import { Wordmark } from './Logo'

export function Footer() {
  const { brand, footer } = landing
  return (
    <footer className="border-t border-line py-8">
      <Container className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Wordmark name={brand} />
        <p className="text-sm text-muted">
          &copy; {new Date().getFullYear()} {footer.copyright}
        </p>
      </Container>
    </footer>
  )
}
