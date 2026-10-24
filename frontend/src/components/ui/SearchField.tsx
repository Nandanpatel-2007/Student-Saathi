import { Search } from 'lucide-react'
import { useId } from 'react'

import { cn } from '../../lib/cn'
import { Input } from './Field'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchField({ label, value, onChange, placeholder, className }: Props) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          className="pl-9"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  )
}
