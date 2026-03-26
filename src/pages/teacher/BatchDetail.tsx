import { useParams, Link } from 'react-router-dom'
import { useBatch } from '../../hooks/useBatches'
import { useBatchStudents } from '../../hooks/useStudents'
import { useBatchAttendance } from '../../hooks/useAttendance'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'
import { formatDateDDMMYYYY } from '../../utils/dates'

export function BatchDetail() {
  const { batchId } = useParams()
  const { batch, loading } = useBatch(batchId)
  const { students } = useBatchStudents(batch?.studentIds || [])
  const { records } = useBatchAttendance(batchId)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!batch) return <div className="text-white/30 text-sm">Batch not found</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{batch.name}</h2>
        <div className="text-sm text-white/50 mt-1">{batch.dayOfWeek} · {batch.time} · {batch.style} · {batch.level}</div>
      </div>

      <Link to={`/teacher/batches/${batch.id}/attendance`}
        className="block w-full bg-[#FF6F00] text-white text-center font-medium rounded-xl py-3 text-sm">
        Mark Attendance
      </Link>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Students ({students.length})</div>
        <div className="space-y-2">
          {students.map((student) => (
            <StudentRow key={student.id} studentId={student.id} name={student.name} />
          ))}
        </div>
      </section>

      {records.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#7B2D8B] mb-3">Recent Attendance</div>
          <div className="space-y-1.5">
            {records.slice(0, 10).map((r) => (
              <div key={r.id} className="bg-white/5 rounded-lg p-2.5 flex justify-between items-center text-sm">
                <div>
                  <span>{r.studentName}</span>
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

function StudentRow({ studentId, name }: { studentId: string; name: string }) {
  const { subscription } = useActiveSubscription(studentId)
  return (
    <Link to={`/teacher/students/${studentId}`} className="bg-white/5 rounded-lg p-3 flex justify-between items-center block">
      <span className="text-sm">{name}</span>
      {subscription && <SubscriptionBadge classesRemaining={subscription.classesRemaining} />}
    </Link>
  )
}
