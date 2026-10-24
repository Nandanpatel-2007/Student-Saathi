import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatPercent } from '../../lib/format'
import type { TrendPoint } from '../../lib/student-api'
import { formatMonth } from '../../lib/student-derive'

const tick = { fill: 'var(--muted)', fontSize: 12 }

/** Monthly attendance %. Months with only excused classes have no percentage and show as gaps. */
export function TrendChart({ trend }: { trend: readonly TrendPoint[] }) {
  const data = trend.map((point) => ({
    label: formatMonth(point.month),
    pct: point.attendance_pct,
    classes: point.classes,
  }))

  return (
    <figure className="m-0">
      <div className="h-64 p-4 pr-5">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={tick} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                color: 'var(--ink)',
              }}
              labelStyle={{ color: 'var(--ink)' }}
              formatter={(value) => [typeof value === 'number' ? formatPercent(value) : 'No percentage', 'Attendance']}
            />
            <Line
              type="monotone"
              dataKey="pct"
              name="Attendance"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Monthly attendance percentage.</figcaption>
      <table className="sr-only">
        <caption>Monthly attendance</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Attendance</th>
            <th scope="col">Classes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.pct === null ? 'No percentage' : formatPercent(row.pct)}</td>
              <td>{row.classes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
