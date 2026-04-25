import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  collection, writeBatch, doc, serverTimestamp, query, where, getDocs, Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import { formatDateDDMMYYYY, getAESTDate } from '../../utils/dates'
import type { PackSize } from '../../types'

const packs: { size: PackSize; label: string }[] = [
  { size: 5, label: '5 Classes' },
  { size: 10, label: '10 Classes' },
  { size: 20, label: '20 Classes' },
]
const MAX_BACKDATE_DAYS = 90

function getFee(packSize: PackSize, category: string | undefined): string {
  if (!category) return ''
  if (packSize === 10) return category === 'Women' ? '$200' : '$150'
  const perClass = category === 'Women' ? 23 : 18
  return `$${perClass * packSize}`
}

function isoDate(d: Date): string {
  const aest = getAESTDate(d)
  return `${aest.getFullYear()}-${String(aest.getMonth() + 1).padStart(2, '0')}-${String(aest.getDate()).padStart(2, '0')}`
}

export function AssignSubscription() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { student, loading } = useStudent(studentId)
  const [selected, setSelected] = useState<PackSize | null>(null)
  const [showBackdate, setShowBackdate] = useState(false)
  const [tab, setTab] = useState<'date' | 'count'>('date')
  const [usedCount, setUsedCount] = useState<number>(0)
  const [pickerValue, setPickerValue] = useState<string>('')
  const [dates, setDates] = useState<Date[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => getAESTDate(new Date()), [])
  const minDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - MAX_BACKDATE_DAYS)
    return d
  }, [today])

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!student) return <div className="text-white/30 text-sm">Student not found</div>

  function addDate() {
    if (!pickerValue || !selected) return
    const [y, m, d] = pickerValue.split('-').map(Number)
    const candidate = new Date(y, m - 1, d)
    const minDay = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (candidate < minDay || candidate > todayDay) return
    if (dates.length >= selected) return
    if (dates.some((existing) => isoDate(existing) === pickerValue)) return
    setDates([...dates, candidate])
  }
  function removeDate(target: Date) {
    setDates(dates.filter((d) => isoDate(d) !== isoDate(target)))
  }

  async function handleAssign() {
    if (!db || !user || !selected || !studentId) return

    if (showBackdate) {
      if (tab === 'date' && dates.length > selected) {
        setError('Number of dates exceeds pack size.')
        return
      }
      if (tab === 'count' && (usedCount < 0 || usedCount > selected)) {
        setError('Used count must be between 0 and pack size.')
        return
      }
    }

    setSaving(true)
    setError(null)

    try {
      // D3: deactivate any existing active subscriptions before creating new one.
      const existingQuery = query(
        collection(db, 'subscriptions'),
        where('studentId', '==', studentId),
        where('isActive', '==', true)
      )
      const existingSnap = await getDocs(existingQuery)

      const batchWrite = writeBatch(db)
      existingSnap.docs.forEach((existingDoc) => {
        batchWrite.update(existingDoc.ref, { isActive: false })
      })

      const newSubRef = doc(collection(db, 'subscriptions'))
      const used = showBackdate && tab === 'count' ? usedCount : 0
      const remaining = selected - used
      const editHistory: Record<string, unknown>[] = []
      if (showBackdate && tab === 'count' && used > 0) {
        editHistory.push({
          action: 'backdate-count',
          editedBy: user.uid,
          editedAt: Timestamp.now(),
          oldValue: { packSize: selected, classesRemaining: selected },
          newValue: { packSize: selected, classesRemaining: remaining },
        })
      }

      batchWrite.set(newSubRef, {
        studentId,
        studentName: student!.name,
        packSize: selected,
        classesRemaining: remaining,
        assignedBy: user.uid,
        assignedAt: serverTimestamp(),
        isActive: remaining > 0,
        editHistory,
      })

      // By-date: write attendance docs with isBackdated:true. The trigger handles
      // FIFO decrement, FCM suppression, and editHistory append.
      if (showBackdate && tab === 'date' && dates.length > 0) {
        for (const d of dates) {
          const ref = doc(collection(db, 'attendance'))
          batchWrite.set(ref, {
            batchId: '',
            studentId,
            studentName: student!.name,
            batchName: 'Backdated entry',
            date: d,
            status: 'present',
            markedBy: user.uid,
            isBackdated: true,
            createdAt: serverTimestamp(),
          })
        }
      }

      await batchWrite.commit()
      navigate(`/teacher/students/${studentId}`)
    } catch (err) {
      console.error('AssignSubscription error:', err)
      setError('Failed to assign pack. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Assign Pack</h2>
        <div className="text-sm text-white/50 mt-1">{student.name}</div>
      </div>

      <div className="space-y-3">
        {packs.map((pack) => (
          <button key={pack.size} onClick={() => setSelected(pack.size)}
            className={`w-full rounded-xl p-4 text-left transition-colors ${
              selected === pack.size
                ? 'bg-[#00BCD4]/20 border-2 border-[#00BCD4]'
                : 'bg-white/5 border-2 border-transparent'
            }`}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-semibold">{pack.label}</div>
                <div className="text-xs text-white/40 mt-1">{pack.size}-class pass</div>
              </div>
              {student?.studentCategory && (
                <div className="text-sm font-semibold text-[#00BCD4]">{getFee(pack.size, student.studentCategory)}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <button
          type="button"
          onClick={() => setShowBackdate((v) => !v)}
          className="w-full text-left rounded-xl bg-white/5 px-4 py-3 text-sm"
        >
          {showBackdate ? '▾' : '▸'} Already attended classes (optional)
        </button>
      )}

      {selected && showBackdate && (
        <div className="rounded-xl bg-white/5 p-4 space-y-3">
          <div role="tablist" className="flex gap-2">
            <button
              role="tab"
              aria-selected={tab === 'date'}
              onClick={() => setTab('date')}
              className={`flex-1 rounded-lg py-1.5 text-xs ${tab === 'date' ? 'bg-[#00BCD4]/20 text-[#00BCD4]' : 'bg-white/5'}`}
            >
              By date
            </button>
            <button
              role="tab"
              aria-selected={tab === 'count'}
              onClick={() => setTab('count')}
              className={`flex-1 rounded-lg py-1.5 text-xs ${tab === 'count' ? 'bg-[#00BCD4]/20 text-[#00BCD4]' : 'bg-white/5'}`}
            >
              By count
            </button>
          </div>

          {tab === 'date' && (
            <>
              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="text-xs uppercase tracking-wider text-[#00BCD4]">Add date</span>
                  <input
                    aria-label="Add date"
                    type="date"
                    min={isoDate(minDate)}
                    max={isoDate(today)}
                    value={pickerValue}
                    onChange={(e) => setPickerValue(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={addDate}
                  className="rounded-lg bg-[#7B2D8B] px-4 py-2 text-sm"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {dates.map((d) => (
                  <button
                    key={isoDate(d)}
                    type="button"
                    onClick={() => removeDate(d)}
                    aria-label={`Remove ${formatDateDDMMYYYY(d)}`}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs"
                  >
                    {formatDateDDMMYYYY(d)} ✕
                  </button>
                ))}
              </div>
              <div className="text-xs text-white/40">
                {dates.length}/{selected} max
              </div>
            </>
          )}

          {tab === 'count' && (
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-[#00BCD4]">Already used</span>
              <input
                aria-label="Already used"
                type="number"
                min={0}
                max={selected}
                value={usedCount}
                onChange={(e) => setUsedCount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-white/40">
                Out of {selected} in this pack
              </span>
            </label>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button onClick={handleAssign} disabled={!selected || saving}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50">
        {saving ? 'Assigning...' : 'Assign Pack'}
      </button>
    </div>
  )
}
