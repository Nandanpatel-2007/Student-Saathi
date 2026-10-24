import { ArrowRight } from 'lucide-react'

import { landing } from '../content/landing'
import { ButtonLink } from './ButtonLink'
import { Container } from './Container'
import { Reveal } from './Reveal'

export function CtaBand() {
  const { cta } = landing
  return (
    <section aria-labelledby="cta-heading" className="bg-band py-20 text-on-band sm:py-24">
      <Container>
        <Reveal className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 id="cta-heading" className="text-3xl font-semibold text-balance sm:text-4xl">
              {cta.title}
            </h2>
            <p className="mt-3 text-lg text-on-band-muted">{cta.body}</p>
          </div>
          <ButtonLink to="/login" variant="inverse" size="lg" className="self-start md:self-auto">
            {cta.button}
            <ArrowRight className="size-5" aria-hidden="true" />
          </ButtonLink>
        </Reveal>
      </Container>
    </section>
  )
}
