import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { useStudentBatches } from '../../hooks/useBatches'
import { getGreeting, getAESTDate, getCurrentDayAEST } from '../../utils/dates'

export function StudentHome() {
  const { user } = useAuth()
  const { student } = useStudent(user?.uid)
  const { subscription } = useActiveSubscription(user?.uid)
  const { batches } = useStudentBatches(student?.batchIds || [])

  const hour = getAESTDate(new Date()).getHours()
  const greeting = getGreeting(hour)
  const currentDay = getCurrentDayAEST()

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayIndex = days.indexOf(currentDay)
  const sortedBatches = [...batches].sort((a, b) => {
    const aIdx = (days.indexOf(a.dayOfWeek) - todayIndex + 7) % 7
    const bIdx = (days.indexOf(b.dayOfWeek) - todayIndex + 7) % 7
    return aIdx - bIdx
  })
  const nextBatch = sortedBatches[0]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-sm text-white/50">{greeting},</div>
        <div className="text-2xl font-semibold mt-0.5">{student?.name || 'Student'}</div>
      </div>

      <div className="bg-gradient-to-br from-[#00BCD4]/20 to-[#7B2D8B]/20 rounded-2xl p-6 text-center">
        <div className="text-xs uppercase tracking-wider text-white/50">Classes Remaining</div>
        <div className="text-5xl font-bold text-[#00BCD4] mt-2">
          {subscription?.classesRemaining ?? 0}
        </div>
        {subscription && (
          <div className="text-xs text-white/40 mt-2">
            {subscription.packSize}-class {batches[0]?.style || ''} pack
          </div>
        )}
        {!subscription && (
          <div className="text-xs text-[#E91E8C] mt-2">No active subscription</div>
        )}
      </div>

      {nextBatch && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#FF6F00] mb-3">Next Class</div>
          <div className="bg-white/5 rounded-xl p-3.5 border-l-[3px] border-l-[#FF6F00]">
            <div className="text-sm font-medium">{nextBatch.name}</div>
            <div className="text-xs text-white/50 mt-0.5">{nextBatch.dayOfWeek} · {nextBatch.time}</div>
          </div>
        </section>
      )}
    </div>
  )
}
