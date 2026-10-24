import { landing } from '../content/landing'
import { cn } from '../lib/cn'
import { Container } from './Container'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

export function HowItWorks() {
  const { how } = landing
  const last = how.steps.length - 1
  return (
    <section
      id={how.id}
      aria-labelledby="how-heading"
      className="scroll-mt-16 border-y border-line bg-surface-alt/60 py-20 sm:py-28"
    >
      <Container>
        <SectionHeading id="how-heading" eyebrow={how.eyebrow} title={how.title} intro={how.intro} />

        {/* Vertical on mobile, five columns from lg. Each step reveals in sequence. */}
        <ol className="mt-14 grid gap-0 lg:grid-cols-5 lg:gap-6">
          {how.steps.map(({ icon: Icon, title, description }, index) => (
            <li key={title} className="relative">
              <Reveal delay={index * 140} className="relative flex gap-5 pb-10 lg:block lg:pb-0">
                {/* Connector to the next step */}
                {index < last && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-12 left-5 h-[calc(100%-2.5rem)] w-px bg-line',
                      'lg:top-5 lg:left-14 lg:h-px lg:w-[calc(100%-2rem)]',
                    )}
                  />
                )}
                <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="lg:mt-5">
                  <p className="text-sm font-medium text-accent-text">Step {index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{description}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
