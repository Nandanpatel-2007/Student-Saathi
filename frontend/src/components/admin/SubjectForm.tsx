import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { createSubject, updateSubject, type SubjectRecord } from '../../lib/admin-api'
import { applyApiFieldErrors } from '../../lib/forms'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Field'
import { StatusMessage } from '../ui/StatusMessage'

const intField = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}.`)
    .refine((v) => /^\d+$/.test(v), 'Use a whole number.')
    .refine((v) => Number(v) >= min && Number(v) <= max, `Must be between ${min} and ${max}.`)

const schema = z.object({
  code: z.string().trim().min(1, 'Enter a subject code.').max(20, 'Keep the code under 20 characters.'),
  name: z.string().trim().min(1, 'Enter the subject name.').max(150, 'Keep the name under 150 characters.'),
  credits: intField('credits', 0, 30),
  semester: intField('semester', 1, 20),
})
type FormValues = z.infer<typeof schema>
const FIELDS = ['code', 'name', 'credits', 'semester'] as const

interface Props {
  subject?: SubjectRecord
  onSaved: (subject: SubjectRecord) => void
  onCancel: () => void
}

export function SubjectForm({ subject, onSaved, onCancel }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: subject?.code ?? '',
      name: subject?.name ?? '',
      credits: subject ? String(subject.credits) : '',
      semester: subject ? String(subject.semester) : '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const input = {
      code: values.code,
      name: values.name,
      credits: Number(values.credits),
      semester: Number(values.semester),
    }
    try {
      onSaved(subject ? await updateSubject(subject.id, input) : await createSubject(input))
    } catch (error) {
      setFormError(applyApiFieldErrors<FormValues>(error, FIELDS, setError, { conflictField: 'code' }))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" htmlFor="sub-code" error={errors.code?.message} hint="Unique, e.g. CS301">
          <Input id="sub-code" invalid={!!errors.code} aria-describedby="sub-code-msg" {...register('code')} />
        </Field>
        <Field label="Semester" htmlFor="sub-sem" error={errors.semester?.message}>
          <Input
            id="sub-sem"
            inputMode="numeric"
            invalid={!!errors.semester}
            aria-describedby={errors.semester ? 'sub-sem-msg' : undefined}
            {...register('semester')}
          />
        </Field>
        <Field label="Name" htmlFor="sub-name" error={errors.name?.message} className="sm:col-span-2">
          <Input
            id="sub-name"
            invalid={!!errors.name}
            aria-describedby={errors.name ? 'sub-name-msg' : undefined}
            {...register('name')}
          />
        </Field>
        <Field label="Credits" htmlFor="sub-credits" error={errors.credits?.message}>
          <Input
            id="sub-credits"
            inputMode="numeric"
            invalid={!!errors.credits}
            aria-describedby={errors.credits ? 'sub-credits-msg' : undefined}
            {...register('credits')}
          />
        </Field>
      </div>

      <StatusMessage notice={formError ? { tone: 'error', text: formError } : null} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {subject ? 'Save changes' : 'Create subject'}
        </Button>
      </div>
    </form>
  )
}
