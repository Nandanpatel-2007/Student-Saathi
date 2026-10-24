import { ChevronDown } from 'lucide-react'
import { useId } from 'react'

import { cn } from '../../lib/cn'
import { Field } from './Field'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  error?: string | null
  hint?: string
  disabled?: boolean
  className?: string
}

export function SelectField({ label, value, onChange, options, error, hint, disabled, className }: Props) {
  const id = useId()
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} className={className}>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            'block h-10 w-full appearance-none rounded-lg border bg-canvas pr-9 pl-3 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-danger-ink' : 'border-line',
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
      </div>
    </Field>
  )
}
