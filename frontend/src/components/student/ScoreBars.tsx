import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatPercent } from '../../lib/format'
import type { SubjectStats } from '../../lib/student-api'

const tick = { fill: 'var(--muted)', fontSize: 12 }

/** Grouped bars: this student's weighted score next to the class average, per subject. */
export function ScoreBars({ subjects }: { subjects: readonly SubjectStats[] }) {
  const data = subjects.map((s) => ({
    code: s.subject.code,
    name: s.subject.name,
    score: s.weighted_score,
    average: s.class_avg,
  }))

  return (
    <figure className="m-0">
      <div className="h-72 p-4 pr-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: -16 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="code" tick={tick} axisLine={false} tickLine={false} interval={0} />
            <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={tick} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--accent-soft)' }}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                color: 'var(--ink)',
              }}
              labelStyle={{ color: 'var(--ink)' }}
              formatter={(value) => (typeof value === 'number' ? formatPercent(value) : 'Not graded')}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
            <Bar dataKey="score" name="Your weighted score" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="average" name="Class average" fill="var(--muted)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Weighted score compared with the class average for each subject.</figcaption>
      <table className="sr-only">
        <caption>Weighted score and class average by subject</caption>
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col">Your weighted score</th>
            <th scope="col">Class average</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.code}>
              <th scope="row">{row.name}</th>
              <td>{row.score === null ? 'Not graded' : formatPercent(row.score)}</td>
              <td>{row.average === null ? 'Not available' : formatPercent(row.average)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
