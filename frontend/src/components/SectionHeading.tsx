import { Reveal } from './Reveal'

interface Props {
  id: string
  eyebrow: string
  title: string
  intro?: string
}

export function SectionHeading({ id, eyebrow, title, intro }: Props) {
  return (
    <Reveal className="max-w-2xl">
      <p className="text-sm font-medium tracking-wide text-accent-text">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl font-semibold text-balance text-ink sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-4 text-lg text-muted">{intro}</p>}
    </Reveal>
  )
}
