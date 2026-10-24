import { TriangleAlert } from 'lucide-react'

import { landing } from '../content/landing'
import { cn } from '../lib/cn'
import { Container } from './Container'
import { Parallax } from './Parallax'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function AttendanceRing({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="size-28 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" className="stroke-line" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-accent"
          strokeDasharray={`${(percent / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        />
      </svg>
      <div>
        <p className="font-display text-4xl font-semibold text-ink">{percent}%</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  )
}

export function DashboardPreview() {
  const { preview } = landing
  return (
    <section aria-labelledby="preview-heading" className="py-20 sm:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-10">
        <div>
          <SectionHeading
            id="preview-heading"
            eyebrow={preview.eyebrow}
            title={preview.title}
            intro={preview.body}
          />
        </div>

        <Parallax speed={0.08} mode="center">
          <Reveal className="mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
            {/* Illustrative mock: described once for assistive tech, internals hidden. */}
            <div
              role="img"
              aria-label={preview.ariaLabel}
              className="-rotate-2 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6"
            >
              <div aria-hidden="true">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{preview.cardTitle}</p>
                  <span className="flex gap-1">
                    <span className="size-2 rounded-full bg-line" />
                    <span className="size-2 rounded-full bg-line" />
                    <span className="size-2 rounded-full bg-accent" />
                  </span>
                </div>

                <div className="mt-5 rounded-xl bg-surface-alt p-4">
                  <AttendanceRing percent={preview.attendancePercent} label={preview.attendanceLabel} />
                </div>

                <div className="mt-4 rounded-xl bg-surface-alt p-4">
                  <p className="text-sm text-muted">{preview.scoresLabel}</p>
                  <div className="mt-3 flex h-28 items-end gap-3">
                    {preview.subjects.map((subject) => (
                      <div key={subject.name} className="flex h-full flex-1 flex-col justify-end gap-1.5">
                        <div
                          className={cn('w-full rounded-t-md', subject.low ? 'bg-warn-bar' : 'bg-accent')}
                          style={{ height: `${subject.score}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-3">
                    {preview.subjects.map((subject) => (
                      <span key={subject.name} className="flex-1 truncate text-center text-[0.7rem] text-muted">
                        {subject.name}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-warn-bg px-3 py-1.5 text-xs font-medium text-warn-ink">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                  {preview.alert}
                </p>
              </div>
            </div>
          </Reveal>
        </Parallax>
      </Container>
    </section>
  )
}
