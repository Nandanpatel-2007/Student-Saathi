import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { RoleMismatchError } from '../auth/errors'
import { useAuth } from '../auth/useAuth'
import { ROLE_LABEL, safeNextPath } from '../auth/utils'
import { FullPageLoader } from '../components/FullPageLoader'
import { Wordmark } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { login as copy } from '../content/auth'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { ApiError } from '../lib/api'
import { cn } from '../lib/cn'
import { ROLES, type Role } from '../types/auth'

const schema = z.object({
  username: z.string().trim().min(1, copy.usernameRequired),
  password: z.string().min(1, copy.passwordRequired),
})

type FormValues = z.infer<typeof schema>

const inputClasses =
  'block h-11 w-full rounded-lg border bg-canvas px-3 text-base text-ink placeholder:text-muted/70 transition-colors'

export function Login() {
  useDocumentTitle('Log in | Student Saathi')
  const { user, status, login } = useAuth()
  const [params] = useSearchParams()
  const [role, setRole] = useState<Role>('STUDENT')
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } })

  if (status === 'loading') return <FullPageLoader />
  // Already signed in (or just signed in): go to ?next= if safe and allowed, else the role home.
  if (status === 'authenticated' && user) {
    return <Navigate to={safeNextPath(params.get('next'), user.role)} replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await login(values, role)
    } catch (error) {
      if (error instanceof RoleMismatchError) setServerError(error.message)
      else if (error instanceof ApiError) setServerError(error.message)
      else setServerError('Something went wrong. Please try again.')
    }
  })

  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-x-clip px-4 py-12">
      <div aria-hidden="true" className="dot-pattern pointer-events-none absolute inset-0 -z-10" />

      <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Link to="/" aria-label="Student Saathi home" className="rounded-md">
            <Wordmark name="Student Saathi" />
          </Link>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-semibold text-ink">{copy.title}</h1>
          <p className="mt-1 text-muted">{copy.subtitle}</p>

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
            <fieldset>
              <legend className="sr-only">{copy.roleLegend}</legend>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-alt p-1">
                {ROLES.map((r) => (
                  <label key={r} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={role === r}
                      onChange={() => {
                        setRole(r)
                        setServerError(null)
                      }}
                      className="peer sr-only"
                    />
                    <span className="flex h-9 items-center justify-center rounded-lg text-sm font-medium text-muted transition-colors peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                      {ROLE_LABEL[r]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-ink">
                {copy.usernameLabel}
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={errors.username ? true : undefined}
                aria-describedby={errors.username ? 'username-error' : 'username-hint'}
                className={cn(inputClasses, errors.username ? 'border-danger-ink' : 'border-line')}
                {...register('username')}
              />
              {errors.username ? (
                <p id="username-error" className="mt-1.5 text-sm text-danger-ink">
                  {errors.username.message}
                </p>
              ) : (
                <p id="username-hint" className="mt-1.5 text-sm text-muted">
                  {copy.usernameHint[role]}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-ink">
                  {copy.passwordLabel}
                </label>
                <span className="group relative">
                  <a
                    href="#forgot-password"
                    onClick={(event) => event.preventDefault()}
                    aria-describedby="forgot-tooltip"
                    className="rounded text-sm text-accent-text underline-offset-4 hover:underline"
                  >
                    {copy.forgot}
                  </a>
                  <span
                    id="forgot-tooltip"
                    role="tooltip"
                    className="pointer-events-none absolute right-0 bottom-full mb-1.5 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-canvas opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                  >
                    {copy.forgotTooltip}
                  </span>
                </span>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={cn(
                    inputClasses,
                    'pr-12',
                    errors.password ? 'border-danger-ink' : 'border-line',
                  )}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" aria-hidden="true" />
                  ) : (
                    <Eye className="size-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-sm text-danger-ink">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Always mounted so screen readers announce the message when it appears. */}
            <div aria-live="polite" role="status" className="min-h-0">
              {serverError && (
                <p className="rounded-lg border border-danger-line bg-danger-bg px-3 py-2.5 text-sm text-danger-ink">
                  {serverError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-base font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
              {isSubmitting ? copy.submitting : copy.submit}
            </button>
          </form>
        </div>

        <Link
          to="/"
          className="mx-auto mt-6 flex w-fit items-center gap-2 rounded text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {copy.backHome}
        </Link>

        {import.meta.env.DEV && <p className="mt-4 text-center text-xs text-muted">{copy.devHint}</p>}
      </div>
    </main>
  )
}
