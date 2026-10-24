import type { InputHTMLAttributes, ReactNode, Ref } from 'react'

import { cn } from '../../lib/cn'

interface FieldProps {
  label: string
  htmlFor: string
  error?: string | null
  hint?: string
  className?: string
  children: ReactNode
}

/** Label + control + hint/error. The control must use `id={htmlFor}` and aria-describedby `${htmlFor}-msg`. */
export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-msg`} className="text-sm text-danger-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-msg`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  ref?: Ref<HTMLInputElement>
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid ? true : undefined}
      className={cn(
        'block h-10 w-full rounded-lg border bg-canvas px-3 text-sm text-ink placeholder:text-muted/70 disabled:cursor-not-allowed disabled:opacity-60',
        invalid ? 'border-danger-ink' : 'border-line',
        className,
      )}
      {...rest}
    />
  )
}
