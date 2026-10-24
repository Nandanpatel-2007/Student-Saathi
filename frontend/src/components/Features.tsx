import { landing } from '../content/landing'
import { Container } from './Container'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

export function Features() {
  const { features } = landing
  return (
    <section id={features.id} aria-labelledby="features-heading" className="scroll-mt-16 py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="features-heading"
          eyebrow={features.eyebrow}
          title={features.title}
          intro={features.intro}
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.items.map(({ icon: Icon, title, description }, index) => (
            <li key={title}>
              <Reveal delay={(index % 3) * 80} className="h-full">
                <article className="h-full rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-accent/50">
                  <span className="inline-flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{description}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
