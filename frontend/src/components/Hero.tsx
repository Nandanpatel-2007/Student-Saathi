import { ArrowDown, ArrowRight } from 'lucide-react'

import { landing } from '../content/landing'
import { ButtonLink } from './ButtonLink'
import { Container } from './Container'
import { Parallax } from './Parallax'
import { ParticleField } from './ParticleField'

export function Hero() {
  const { hero } = landing
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden"
    >
      {/* Decorative layers: blurred accent shapes and the particle field. */}
      <Parallax speed={0.35} decorative className="pointer-events-none absolute inset-0 -z-10">
        <ParticleField />
      </Parallax>
      <Parallax speed={0.22} decorative className="pointer-events-none absolute -top-24 -right-24 -z-10">
        <div className="size-80 rounded-full bg-accent/15 blur-3xl sm:size-[28rem]" />
      </Parallax>
      <Parallax speed={0.4} decorative className="pointer-events-none absolute bottom-0 -left-32 -z-10">
        <div className="size-72 rounded-full bg-accent/10 blur-3xl" />
      </Parallax>
      <Parallax speed={0.15} decorative className="pointer-events-none absolute top-1/3 left-1/2 -z-10">
        <div className="size-48 rounded-full bg-accent/10 blur-2xl" />
      </Parallax>

      <Container className="py-16 sm:py-24">
        <Parallax speed={0.12}>
          <p className="mb-6 inline-flex items-center gap-2 text-sm font-medium tracking-wide text-accent-text">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {hero.eyebrow}
          </p>
          <h1
            id="hero-heading"
            className="max-w-3xl font-display text-4xl leading-[1.05] font-semibold text-balance text-ink sm:text-6xl lg:text-7xl"
          >
            {hero.headline}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">{hero.subhead}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/login" size="lg">
              {hero.primaryCta}
              <ArrowRight className="size-5" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="#how-it-works" variant="secondary" size="lg">
              {hero.secondaryCta}
              <ArrowDown className="size-5" aria-hidden="true" />
            </ButtonLink>
          </div>
        </Parallax>
      </Container>
    </section>
  )
}
