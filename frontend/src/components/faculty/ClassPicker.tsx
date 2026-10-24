import { useMemo } from 'react'

import { ALL_CLASSES } from '../../hooks/useSelectedClass'
import { classLabel, type FacultyClass } from '../../lib/faculty-api'
import { SelectField } from '../ui/SelectField'

interface Props {
  classes: readonly FacultyClass[]
  value: string
  onChange: (value: string) => void
  allowAll?: boolean
  label?: string
  className?: string
}

export function ClassPicker({ classes, value, onChange, allowAll = false, label = 'Class', className }: Props) {
  const options = useMemo(
    () => [
      ...(allowAll ? [{ value: ALL_CLASSES, label: 'All classes' }] : []),
      ...classes.map((c) => ({ value: String(c.assignment_id), label: classLabel(c) })),
    ],
    [classes, allowAll],
  )
  return <SelectField label={label} value={value} onChange={onChange} options={options} className={className} />
}
