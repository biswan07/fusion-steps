import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  collection,
  writeBatch,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useBatch } from '../../hooks/useBatches'
import { useBatchStudents } from '../../hooks/useStudents'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'

export function MarkAttendance() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { batch, loading } = useBatch(batchId)
  const { students } = useBatchStudents(batch?.studentIds || [])
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!batch) return <div className="text-white/30 text-sm">Batch not found</div>

  function toggle(studentId: string) {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }))
  }

  async function handleSubmit() {
    if (!db || !user || !batch) return
    setSubmitting(true)
    setError(null)
    setShowConfirm(false)

    try {
      // Fix S10 + Bug4: duplicate prevention using AEST timezone
      const { getAESTDate } = await import('../../utils/dates')
      const aestNow = getAESTDate(new Date())
      const todayStart = new Date(aestNow.getFullYear(), aestNow.getMonth(), aestNow.getDate(), 0, 0, 0, 0)
      const todayEnd = new Date(aestNow.getFullYear(), aestNow.getMonth(), aestNow.getDate(), 23, 59, 59, 999)

      const existingQuery = query(
        collection(db, 'attendance'),
        where('batchId', '==', batch.id),
        where('date', '>=', todayStart),
        where('date', '<=', todayEnd)
      )
      const existingSnap = await getDocs(existingQuery)
      if (!existingSnap.empty) {
        setError('Attendance has already been submitted for this batch today.')
        setSubmitting(false)
        return
      }

      const batchWrite = writeBatch(db)
      const now = new Date()

      for (const student of students) {
        const status = attendance[student.id] || 'absent'
        const ref = doc(collection(db, 'attendance'))
        batchWrite.set(ref, {
          batchId: batch.id,
          studentId: student.id,
          studentName: student.name,
          batchName: batch.name,
          date: now,
          status,
          markedBy: user.uid,
          createdAt: serverTimestamp(),
        })

        // Subscription deduction is handled by the onAttendanceCreated Cloud Function
        // to avoid double-decrement and ensure server-side enforcement
      }

      await batchWrite.commit()
      navigate(`/teacher/batches/${batch.id}`)
    } catch (err) {
      console.error('Attendance submit error:', err)
      setError('Failed to submit attendance. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const markedCount = Object.values(attendance).filter((s) => s === 'present').length

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{batch.name}</h2>
        <div className="text-sm text-white/50">Mark attendance · {markedCount} present</div>
      </div>

      <div className="space-y-2">
        {students.map((student) => (
          <StudentAttendanceRow
            key={student.id}
            studentId={student.id}
            name={student.name}
            status={attendance[student.id] || 'absent'}
            onToggle={() => toggle(student.id)}
          />
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={() => setShowConfirm(true)}
        disabled={submitting}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Attendance'}
      </button>

      {/* Fix D8: confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl bg-[#1A1A2E] border border-white/10 p-6 space-y-4">
            <h3 className="text-base font-semibold">Confirm Attendance</h3>
            <p className="text-sm text-white/60">
              {markedCount} student{markedCount !== 1 ? 's' : ''} marked present for{' '}
              <span className="text-white/80 font-medium">{batch.name}</span>. This will deduct
              one class from each present student's subscription.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm font-medium text-white/70"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-xl bg-[#FF6F00] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StudentAttendanceRow({
  studentId, name, status, onToggle,
}: {
  studentId: string; name: string; status: 'present' | 'absent'; onToggle: () => void
}) {
  const { subscription } = useActiveSubscription(studentId)
  const noClasses = subscription && subscription.classesRemaining === 0
  const isPresent = status === 'present'

  return (
    <div
      onClick={noClasses ? undefined : onToggle}
      className={`rounded-xl p-3.5 flex justify-between items-center cursor-pointer transition-colors ${
        isPresent ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-white/5 border border-transparent'
      } ${noClasses ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div>
        <div className="text-sm font-medium">{name}</div>
        {noClasses && <div className="text-[10px] text-[#E91E8C] mt-0.5">No classes remaining</div>}
      </div>
      <div className="flex items-center gap-2">
        {subscription && <SubscriptionBadge classesRemaining={subscription.classesRemaining} />}
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${
          isPresent ? 'border-emerald-400 bg-emerald-400 text-white' : 'border-white/20'
        }`}>
          {isPresent && '✓'}
        </div>
      </div>
    </div>
  )
}
