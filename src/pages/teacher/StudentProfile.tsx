import { useParams, Link } from 'react-router-dom'
import { doc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase'
import { useStudent } from '../../hooks/useStudents'
import { useStudentSubscriptions } from '../../hooks/useSubscriptions'
import { useStudentAttendance } from '../../hooks/useAttendance'
import { useBatches } from '../../hooks/useBatches'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'
import { formatDateDDMMYYYY } from '../../utils/dates'
import { useState } from 'react'

export function StudentProfile() {
  const { studentId } = useParams()
  const { student, loading } = useStudent(studentId)
  const { subscriptions } = useStudentSubscriptions(studentId)
  const { records } = useStudentAttendance(studentId)
  const { batches: allBatches } = useBatches()
  const [addingBatch, setAddingBatch] = useState(false)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!student) return <div className="text-white/30 text-sm">Student not found</div>

  const availableBatches = allBatches.filter((b) => !student.batchIds.includes(b.id))
  const activeSub = subscriptions.find((s) => s.isActive)

  async function addToBatch(batchId: string) {
    if (!db || !studentId) return
    const batch = writeBatch(db)
    batch.update(doc(db, 'users', studentId), { batchIds: arrayUnion(batchId) })
    batch.update(doc(db, 'batches', batchId), { studentIds: arrayUnion(studentId) })
    await batch.commit()
    setAddingBatch(false)
  }

  async function removeFromBatch(batchId: string) {
    if (!db || !studentId) return
    const batch = writeBatch(db)
    batch.update(doc(db, 'users', studentId), { batchIds: arrayRemove(batchId) })
    batch.update(doc(db, 'batches', batchId), { studentIds: arrayRemove(studentId) })
    await batch.commit()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{student.name}</h2>
        <div className="text-sm text-white/50">{student.email}</div>
        {student.phone && <div className="text-sm text-white/50">{student.phone}</div>}
      </div>

      <div className="flex gap-3">
        <Link to={`/teacher/students/${studentId}/subscribe`}
          className="flex-1 bg-[#FF6F00] text-white text-center font-medium rounded-xl py-2.5 text-sm">
          Assign Pack
        </Link>
        <button onClick={() => setAddingBatch(!addingBatch)}
          className="flex-1 bg-[#7B2D8B] text-white font-medium rounded-xl py-2.5 text-sm">
          {addingBatch ? 'Cancel' : 'Add to Batch'}
        </button>
      </div>

      {addingBatch && availableBatches.length > 0 && (
        <div className="bg-white/5 rounded-xl p-3 space-y-2">
          {availableBatches.map((b) => (
            <button key={b.id} onClick={() => addToBatch(b.id)}
              className="w-full bg-white/5 rounded-lg p-2.5 text-left text-sm hover:bg-white/10">
              {b.name}
            </button>
          ))}
        </div>
      )}

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Subscription</div>
        {activeSub ? (
          <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
            <div>
              <div className="text-sm">{activeSub.packSize}-class pack</div>
              <div className="text-xs text-white/40 mt-0.5">Assigned {formatDateDDMMYYYY(activeSub.assignedAt)}</div>
            </div>
            <SubscriptionBadge classesRemaining={activeSub.classesRemaining} />
          </div>
        ) : (
          <p className="text-white/30 text-sm">No active subscription</p>
        )}
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Batches ({student.batchIds.length})</div>
        <div className="space-y-2">
          {allBatches.filter((b) => student.batchIds.includes(b.id)).map((b) => (
            <div key={b.id} className="bg-white/5 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm">{b.name}</span>
              <button onClick={() => removeFromBatch(b.id)} className="text-xs text-[#E91E8C]">Remove</button>
            </div>
          ))}
        </div>
      </section>

      {records.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#7B2D8B] mb-3">Attendance History</div>
          <div className="space-y-1.5">
            {records.slice(0, 20).map((r) => (
              <div key={r.id} className="bg-white/5 rounded-lg p-2.5 flex justify-between items-center text-sm">
                <div>
                  <span>{r.batchName}</span>
                  <span className="text-white/40 ml-2 text-xs">{formatDateDDMMYYYY(r.date)}</span>
                </div>
                <span className={r.status === 'present' ? 'text-emerald-400' : 'text-red-400'}>
                  {r.status === 'present' ? 'Present ✓' : 'Absent ✗'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
