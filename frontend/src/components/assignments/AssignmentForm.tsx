import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  createAssignment,
  updateAssignment,
  type AssignmentInput,
  type AssignmentRecord,
} from '../../lib/assignments-api'
import { applyApiFieldErrors } from '../../lib/forms'
import { istInputToIso, toIstInputValue } from '../../lib/format'
import { Button } from '../ui/Button'
import { Field, Input, Textarea } from '../ui/Field'
import { StatusMessage } from '../ui/StatusMessage'

const schema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(150, 'Keep the title under 150 characters.'),
  description: z.string().max(5000, 'Keep the description under 5000 characters.'),
  due_at: z.string().refine((v) => istInputToIso(v) !== null, 'Pick a due date and time.'),
  max_marks: z
    .string()
    .trim()
    .min(1, 'Enter the maximum marks.')
    .refine((v) => Number(v) > 0, 'Must be greater than 0.')
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Use at most 2 decimal places.'),
  allow_late_submissions: z.boolean(),
})
type FormValues = z.infer<typeof schema>
const FIELDS = ['title', 'description', 'due_at', 'max_marks', 'allow_late_submissions'] as const

/** Tomorrow at 17:00 IST as a datetime-local value. */
function defaultDue(): string {
  return `${toIstInputValue(new Date(Date.now() + 24 * 3600 * 1000)).slice(0, 10)}T17:00`
}

interface Props {
  teachingAssignmentId: number
  assignment?: AssignmentRecord
  onSaved: (assignment: AssignmentRecord) => void
  onCancel: () => void
}

export function AssignmentForm({ teachingAssignmentId, assignment, onSaved, onCancel }: Props) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: assignment?.title ?? '',
      description: assignment?.description ?? '',
      due_at: assignment ? toIstInputValue(assignment.due_at) : defaultDue(),
      max_marks: assignment ? String(assignment.max_marks) : '',
      allow_late_submissions: assignment?.allow_late_submissions ?? true,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const input: AssignmentInput = {
      title: values.title,
      description: values.description,
      due_at: istInputToIso(values.due_at) ?? '',
      max_marks: Number(values.max_marks),
      allow_late_submissions: values.allow_late_submissions,
    }
    try {
      onSaved(
        assignment
          ? await updateAssignment(assignment.id, input)
          : await createAssignment(teachingAssignmentId, input),
      )
    } catch (error) {
      setFormError(applyApiFieldErrors<FormValues>(error, FIELDS, setError))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
      <Field label="Title" htmlFor="asg-title" error={errors.title?.message}>
        <Input
          id="asg-title"
          invalid={!!errors.title}
          aria-describedby={errors.title ? 'asg-title-msg' : undefined}
          {...register('title')}
        />
      </Field>

      <Field label="Description (optional)" htmlFor="asg-desc" error={errors.description?.message}>
        <Textarea
          id="asg-desc"
          invalid={!!errors.description}
          aria-describedby={errors.description ? 'asg-desc-msg' : undefined}
          {...register('description')}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Due date and time (IST)"
          htmlFor="asg-due"
          error={errors.due_at?.message}
          hint={
            assignment
              ? 'Changing this re-checks every submission against the new deadline.'
              : 'India Standard Time.'
          }
        >
          <Input
            id="asg-due"
            type="datetime-local"
            invalid={!!errors.due_at}
            aria-describedby="asg-due-msg"
            {...register('due_at')}
          />
        </Field>
        <Field label="Maximum marks" htmlFor="asg-max" error={errors.max_marks?.message}>
          <Input
            id="asg-max"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            invalid={!!errors.max_marks}
            aria-describedby={errors.max_marks ? 'asg-max-msg' : undefined}
            {...register('max_marks')}
          />
        </Field>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-[var(--accent)]"
          aria-describedby="asg-late-help"
          {...register('allow_late_submissions')}
        />
        <span>
          <span className="block text-sm font-medium text-ink">Accept late submissions</span>
          <span id="asg-late-help" className="block text-sm text-muted">
            Late work is accepted and clearly marked as late. Turn this off to close submissions at the deadline.
          </span>
        </span>
      </label>

      <StatusMessage notice={formError ? { tone: 'error', text: formError } : null} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {assignment ? 'Save changes' : 'Post assignment'}
        </Button>
      </div>
    </form>
  )
}
