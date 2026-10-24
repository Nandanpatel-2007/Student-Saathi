import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { ApiError } from '../../lib/api'
import {
  ASSESSMENT_TYPES,
  createAssessment,
  updateAssessment,
  type Assessment,
  type AssessmentInput,
} from '../../lib/faculty-api'
import { errorMessage, formatNumber, todayISO } from '../../lib/format'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { Field, Input } from '../ui/Field'
import { SelectField } from '../ui/SelectField'
import { StatusMessage, type Notice } from '../ui/StatusMessage'

const TYPE_LABEL: Record<(typeof ASSESSMENT_TYPES)[number], string> = {
  QUIZ: 'Quiz',
  MIDTERM: 'Midterm',
  ASSIGNMENT: 'Assignment',
  PRACTICAL: 'Practical',
  OTHER: 'Other',
}
const TYPE_OPTIONS = ASSESSMENT_TYPES.map((value) => ({ value, label: TYPE_LABEL[value] }))

const schema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(150, 'Keep the title under 150 characters.'),
  type: z.enum(ASSESSMENT_TYPES),
  max_marks: z
    .string()
    .trim()
    .min(1, 'Enter the maximum marks.')
    .refine((v) => Number(v) > 0, 'Must be greater than 0.')
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Use at most 2 decimal places.'),
  weightage_percent: z
    .string()
    .trim()
    .min(1, 'Enter the weightage.')
    .refine((v) => Number(v) >= 0 && Number(v) <= 100, 'Must be between 0 and 100.')
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Use at most 2 decimal places.'),
  date: z.string().min(1, 'Pick a date.'),
})

type FormValues = z.infer<typeof schema>
const FIELDS: ReadonlyArray<keyof FormValues> = ['title', 'type', 'max_marks', 'weightage_percent', 'date']

interface Props {
  assignmentId: number
  /** Present when editing. */
  assessment?: Assessment
  /** Weightage already used by the class's other assessments. */
  usedElsewhere: number
  onSaved: (assessment: Assessment) => void
  onCancel: () => void
}

export function AssessmentForm({ assignmentId, assessment, usedElsewhere, onSaved, onCancel }: Props) {
  const [notice, setNotice] = useState<Notice | null>(null)
  const remaining = Math.max(0, 100 - usedElsewhere)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: assessment?.title ?? '',
      type: assessment?.type ?? 'QUIZ',
      max_marks: assessment ? String(assessment.max_marks) : '',
      weightage_percent: assessment ? String(assessment.weightage_percent) : '',
      date: assessment?.date ?? todayISO(),
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setNotice(null)
    const weightage = Number(values.weightage_percent)
    if (weightage > remaining) {
      setError('weightage_percent', {
        message: `Only ${formatNumber(remaining, 2)}% is left for this class (total cannot exceed 100%).`,
      })
      return
    }
    const input: AssessmentInput = {
      title: values.title,
      type: values.type,
      max_marks: Number(values.max_marks),
      weightage_percent: weightage,
      date: values.date,
    }
    try {
      const saved = assessment
        ? await updateAssessment(assessment.id, input)
        : await createAssessment(assignmentId, input)
      onSaved(saved)
    } catch (error) {
      // Show API validation messages next to the field they belong to.
      let placed = false
      if (error instanceof ApiError) {
        for (const detail of error.details) {
          const name = detail.field?.split('.').pop()
          const field = FIELDS.find((f) => f === name)
          if (field) {
            setError(field, { message: detail.message })
            placed = true
          }
        }
      }
      if (!placed) setNotice({ tone: 'error', text: errorMessage(error) })
    }
  })

  const heading = assessment ? `Edit “${assessment.title}”` : 'New assessment'

  return (
    <Card>
      <CardHeader title={heading} subtitle="All fields are required." />
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="as-title" error={errors.title?.message} className="sm:col-span-2">
            <Input
              id="as-title"
              invalid={!!errors.title}
              aria-describedby={errors.title ? 'as-title-msg' : undefined}
              {...register('title')}
            />
          </Field>

          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Type"
                value={field.value}
                onChange={field.onChange}
                options={TYPE_OPTIONS}
                error={errors.type?.message}
              />
            )}
          />

          <Field label="Date" htmlFor="as-date" error={errors.date?.message}>
            <Input
              id="as-date"
              type="date"
              invalid={!!errors.date}
              aria-describedby={errors.date ? 'as-date-msg' : undefined}
              {...register('date')}
            />
          </Field>

          <Field label="Maximum marks" htmlFor="as-max" error={errors.max_marks?.message}>
            <Input
              id="as-max"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              invalid={!!errors.max_marks}
              aria-describedby={errors.max_marks ? 'as-max-msg' : undefined}
              {...register('max_marks')}
            />
          </Field>

          <Field
            label="Weightage (%)"
            htmlFor="as-weight"
            error={errors.weightage_percent?.message}
            hint={`Up to ${formatNumber(remaining, 2)}% is available for this class.`}
          >
            <Input
              id="as-weight"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              invalid={!!errors.weightage_percent}
              aria-describedby="as-weight-msg"
              {...register('weightage_percent')}
            />
          </Field>
        </div>

        <StatusMessage notice={notice} />

        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {assessment ? 'Save changes' : 'Create assessment'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
