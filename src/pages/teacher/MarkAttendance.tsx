import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore'
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

    const batch_write = writeBatch(db)
    const now = new Date()

    for (const student of students) {
      const status = attendance[student.id] || 'absent'
      const ref = doc(collection(db, 'attendance'))
      batch_write.set(ref, {
        batchId: batch.id,
        studentId: student.id,
        studentName: student.name,
        batchName: batch.name,
        date: now,
        status,
        markedBy: user.uid,
        createdAt: serverTimestamp(),
      })
    }

    await batch_write.commit()
    setSubmitting(false)
    navigate(`/teacher/batches/${batch.id}`)
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

      <button onClick={handleSubmit} disabled={submitting}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50">
        {submitting ? 'Submitting...' : 'Submit Attendance'}
      </button>
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
