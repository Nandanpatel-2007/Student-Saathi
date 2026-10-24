import { BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageTitle } from '../../components/faculty/PageTitle'
import { Card } from '../../components/ui/Card'
import { useFacultyContext } from '../../hooks/useFacultyContext'

const linkClass =
  'inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-alt'

export function SubjectsPage() {
  const { classes } = useFacultyContext()
  return (
    <div className="space-y-6">
      <PageTitle title="Subjects" subtitle="The subject and section pairs you teach." />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => {
          const query = `?class=${c.assignment_id}`
          return (
            <li key={c.assignment_id}>
              <Card className="flex h-full flex-col p-5">
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                  <BookOpen className="size-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-ink">{c.subject.name}</h2>
                <p className="text-sm text-muted">
                  {c.subject.code} · {c.subject.credits} credit{c.subject.credits === 1 ? '' : 's'} · Semester{' '}
                  {c.subject.semester}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-line py-3 text-sm">
                  <div>
                    <dt className="text-muted">Section</dt>
                    <dd className="mt-0.5 font-medium text-ink">{c.section.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Year</dt>
                    <dd className="mt-0.5 font-medium text-ink">{c.section.academic_year}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted">Programme</dt>
                    <dd className="mt-0.5 font-medium text-ink">
                      {c.section.program}, semester {c.section.semester}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/faculty/attendance${query}`} className={linkClass}>
                    Attendance
                    <span className="sr-only"> for {c.subject.name}, section {c.section.name}</span>
                  </Link>
                  <Link to={`/faculty/assessments${query}`} className={linkClass}>
                    Assessments
                    <span className="sr-only"> for {c.subject.name}, section {c.section.name}</span>
                  </Link>
                  <Link to={`/faculty/students${query}`} className={linkClass}>
                    Students
                    <span className="sr-only"> of {c.subject.name}, section {c.section.name}</span>
                  </Link>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
