import { Download } from 'lucide-react'
import { useState } from 'react'

import { downloadClassCsv, type FacultyClass } from '../../lib/faculty-api'
import { errorMessage } from '../../lib/format'
import { Button } from '../ui/Button'
import { StatusMessage, type Notice } from '../ui/StatusMessage'

type Kind = 'attendance' | 'marks'

/** CSV downloads for one class; fetched with the bearer token, then saved via a temporary link. */
export function ExportButtons({ cls }: { cls: FacultyClass }) {
  const [busy, setBusy] = useState<Kind | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const run = async (kind: Kind) => {
    setBusy(kind)
    setNotice(null)
    try {
      await downloadClassCsv(cls, kind)
      setNotice({ tone: 'success', text: `Downloaded the ${kind} sheet.` })
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => run('attendance')} loading={busy === 'attendance'} disabled={busy !== null}>
          {busy !== 'attendance' && <Download className="size-4" aria-hidden="true" />}
          Attendance CSV
        </Button>
        <Button size="sm" onClick={() => run('marks')} loading={busy === 'marks'} disabled={busy !== null}>
          {busy !== 'marks' && <Download className="size-4" aria-hidden="true" />}
          Marks CSV
        </Button>
      </div>
      <StatusMessage notice={notice} />
    </div>
  )
}
