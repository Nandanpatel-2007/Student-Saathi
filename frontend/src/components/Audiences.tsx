import { Check } from 'lucide-react'

import { landing } from '../content/landing'
import { Container } from './Container'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

export function Audiences() {
  const { audiences } = landing
  return (
    <section aria-labelledby="audiences-heading" className="border-t border-line py-20 sm:py-28">
      <Container>
        <SectionHeading id="audiences-heading" eyebrow={audiences.eyebrow} title={audiences.title} />
        <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {audiences.items.map((audience, index) => (
            <Reveal key={audience.id} delay={index * 100} className="h-full">
              <section
                id={audience.id}
                aria-labelledby={`${audience.id}-heading`}
                className="h-full scroll-mt-20 rounded-2xl border border-line bg-surface p-6 sm:p-8"
              >
                <h3 id={`${audience.id}-heading`} className="text-2xl font-semibold text-ink">
                  {audience.title}
                </h3>
                <p className="mt-2 text-muted">{audience.lead}</p>
                <ul className="mt-6 space-y-4">
                  {audience.outcomes.map((outcome) => (
                    <li key={outcome} className="flex gap-3">
                      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                        <Check className="size-4" aria-hidden="true" />
                      </span>
                      <span className="text-ink">{outcome}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
