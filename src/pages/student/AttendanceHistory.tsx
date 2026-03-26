import { useAuth } from '../../hooks/useAuth'
import { useStudentAttendance } from '../../hooks/useAttendance'
import { formatDateDDMMYYYY } from '../../utils/dates'

export function AttendanceHistory() {
  const { user } = useAuth()
  const { records, loading } = useStudentAttendance(user?.uid)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Attendance History</h2>
      {records.length === 0 ? (
        <p className="text-white/30 text-sm">No attendance records yet</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="bg-white/5 rounded-xl p-3.5 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{r.batchName}</div>
                <div className="text-xs text-white/40 mt-0.5">{formatDateDDMMYYYY(r.date)}</div>
              </div>
              <span className={r.status === 'present' ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm'}>
                {r.status === 'present' ? 'Present ✓' : 'Absent ✗'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
