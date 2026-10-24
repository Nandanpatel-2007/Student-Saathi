import { BookOpen, GraduationCap, Layers, UserCheck, Users, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageTitle } from '../../components/faculty/PageTitle'
import { StatCard } from '../../components/faculty/StatCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/States'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchOverview } from '../../lib/admin-api'
import { errorMessage } from '../../lib/format'

const LINKS = [
  { to: '/admin/subjects', title: 'Subjects', body: 'Create and edit the subjects that are taught.' },
  { to: '/admin/sections', title: 'Sections', body: 'Set up class sections for each programme and year.' },
  { to: '/admin/teaching', title: 'Teaching assignments', body: 'Decide which faculty member teaches which subject to which section.' },
  { to: '/admin/enrollments', title: 'Enrollments', body: 'Enrol a whole section, or individual students, in a subject.' },
] as const

export function OverviewPage() {
  const overview = useAsyncData('admin-overview', fetchOverview)
  const data = overview.data

  return (
    <div className="space-y-6">
      <PageTitle title="Overview" subtitle="Set up subjects, sections, teaching and enrollments." />

      {overview.error ? (
        <Card>
          <ErrorState message={errorMessage(overview.error)} onRetry={overview.reload} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard title="Students" value={String(data?.students ?? 0)} icon={Users} loading={overview.loading} />
          <StatCard title="Faculty" value={String(data?.faculty ?? 0)} icon={UsersRound} loading={overview.loading} />
          <StatCard title="Subjects" value={String(data?.subjects ?? 0)} icon={BookOpen} loading={overview.loading} />
          <StatCard title="Sections" value={String(data?.sections ?? 0)} icon={Layers} loading={overview.loading} />
          <StatCard
            title="Teaching assignments"
            value={String(data?.teaching_assignments ?? 0)}
            icon={UserCheck}
            loading={overview.loading}
          />
          <StatCard
            title="Enrollments"
            value={String(data?.enrollments ?? 0)}
            caption="Student-subject links"
            icon={GraduationCap}
            loading={overview.loading}
          />
        </div>
      )}

      <Card>
        <CardHeader title="Quick links" subtitle="A typical order: subjects, sections, teaching, then enrollments." />
        <ul className="divide-y divide-line">
          {LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="block px-5 py-4 transition-colors hover:bg-surface-alt">
                <span className="font-medium text-accent-text">{link.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{link.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
