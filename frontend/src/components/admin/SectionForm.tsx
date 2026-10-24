import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { createSection, updateSection, type SectionRecord } from '../../lib/admin-api'
import { applyApiFieldErrors } from '../../lib/forms'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Field'
import { StatusMessage } from '../ui/StatusMessage'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a section name.').max(50, 'Keep the name under 50 characters.'),
  program: z.string().trim().min(1, 'Enter the programme.').max(100, 'Keep the programme under 100 characters.'),
  semester: z
    .string()
    .trim()
    .min(1, 'Enter the semester.')
    .refine((v) => /^\d+$/.test(v), 'Use a whole number.')
    .refine((v) => Number(v) >= 1 && Number(v) <= 20, 'Must be between 1 and 20.'),
  academic_year: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Use the form 2025-2026.'),
})
type FormValues = z.infer<typeof schema>
const FIELDS = ['name', 'program', 'semester', 'academic_year'] as const

interface Props {
  section?: SectionRecord
  onSaved: (section: SectionRecord) => void
  onCancel: () => void
}

export function SectionForm({ section, onSaved, onCancel }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: section?.name ?? '',
      program: section?.program ?? '',
      semester: section ? String(section.semester) : '',
      academic_year: section?.academic_year ?? '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const input = {
      name: values.name,
      program: values.program,
      semester: Number(values.semester),
      academic_year: values.academic_year,
    }
    try {
      onSaved(section ? await updateSection(section.id, input) : await createSection(input))
    } catch (error) {
      setFormError(applyApiFieldErrors<FormValues>(error, FIELDS, setError))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Section name" htmlFor="sec-name" error={errors.name?.message} hint="e.g. A">
          <Input id="sec-name" invalid={!!errors.name} aria-describedby="sec-name-msg" {...register('name')} />
        </Field>
        <Field label="Semester" htmlFor="sec-sem" error={errors.semester?.message}>
          <Input
            id="sec-sem"
            inputMode="numeric"
            invalid={!!errors.semester}
            aria-describedby={errors.semester ? 'sec-sem-msg' : undefined}
            {...register('semester')}
          />
        </Field>
        <Field label="Programme" htmlFor="sec-prog" error={errors.program?.message} className="sm:col-span-2">
          <Input
            id="sec-prog"
            invalid={!!errors.program}
            aria-describedby={errors.program ? 'sec-prog-msg' : undefined}
            {...register('program')}
          />
        </Field>
        <Field label="Academic year" htmlFor="sec-year" error={errors.academic_year?.message} hint="e.g. 2025-2026">
          <Input
            id="sec-year"
            invalid={!!errors.academic_year}
            aria-describedby="sec-year-msg"
            {...register('academic_year')}
          />
        </Field>
      </div>

      <StatusMessage notice={formError ? { tone: 'error', text: formError } : null} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {section ? 'Save changes' : 'Create section'}
        </Button>
      </div>
    </form>
  )
}
