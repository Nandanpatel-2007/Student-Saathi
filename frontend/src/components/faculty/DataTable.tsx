import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface Props<T> {
  columns: readonly Column<T>[]
  rows: readonly T[]
  rowKey: (row: T) => string | number
  /** Accessible name for the table. */
  caption: string
  rowClassName?: (row: T) => string | undefined
}

const alignment = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

export function DataTable<T>({ columns, rows, rowKey, caption, rowClassName }: Props<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-surface-alt/70">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-5 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase',
                  alignment[column.align ?? 'left'],
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={cn('border-t border-line', rowClassName?.(row))}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn('px-5 py-3 align-middle text-ink', alignment[column.align ?? 'left'], column.className)}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
