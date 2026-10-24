import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { HistogramBucket } from '../../lib/faculty-api'

const tick = { fill: 'var(--muted)', fontSize: 12 }

/** Bar chart of weighted-score buckets. Colours come from CSS variables so both themes work. */
export function MarksDistributionChart({ buckets }: { buckets: readonly HistogramBucket[] }) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  const summary = buckets.filter((b) => b.count > 0).map((b) => `${b.label}%: ${b.count}`).join(', ')

  return (
    <figure className="m-0">
      <div className="h-64 p-4 pr-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[...buckets]} margin={{ top: 8, right: 0, bottom: 0, left: -16 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--accent-soft)' }}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                color: 'var(--ink)',
              }}
              labelStyle={{ color: 'var(--ink)' }}
              labelFormatter={(label) => `Score ${String(label)}%`}
              formatter={(value) => [String(value), 'Students']}
            />
            <Bar dataKey="count" name="Students" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Distribution of weighted scores across {total} graded students. {summary || 'No graded students yet.'}
      </figcaption>
    </figure>
  )
}
