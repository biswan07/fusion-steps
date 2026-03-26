import { useAuth } from '../../hooks/useAuth'
import { useBatches } from '../../hooks/useBatches'
import { useStudent } from '../../hooks/useStudents'
import { useLowBalanceStudents } from '../../hooks/useSubscriptions'
import { useVideos } from '../../hooks/useVideos'
import { BatchCard } from '../../components/BatchCard'
import { VideoCard } from '../../components/VideoCard'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'
import { getGreeting, getCurrentDayAEST, getAESTDate } from '../../utils/dates'

export function TeacherDashboard() {
  const { user } = useAuth()
  const { student: teacherDoc } = useStudent(user?.uid)
  const { batches } = useBatches()
  const { subscriptions: lowBalanceSubs } = useLowBalanceStudents()
  const { videos } = useVideos(undefined, 3)

  const currentDay = getCurrentDayAEST()
  const todayBatches = batches.filter((b) => b.dayOfWeek === currentDay)
  const hour = getAESTDate(new Date()).getHours()
  const greeting = getGreeting(hour)

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-white/50">{greeting},</div>
        <div className="text-2xl font-semibold mt-0.5">{teacherDoc?.name || 'Teacher'}</div>
      </div>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Today's Batches</div>
        {todayBatches.length === 0 ? (
          <p className="text-white/30 text-sm">No batches today</p>
        ) : (
          <div className="space-y-2">
            {todayBatches.map((batch) => (
              <BatchCard key={batch.id} batch={batch} showMarkButton />
            ))}
          </div>
        )}
      </section>

      {lowBalanceSubs.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#E91E8C] mb-3">Low Balance Alerts</div>
          <div className="space-y-2">
            {lowBalanceSubs.map((sub) => (
              <div key={sub.id} className="bg-[#E91E8C]/10 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm">{sub.studentName}</span>
                <SubscriptionBadge classesRemaining={sub.classesRemaining} />
              </div>
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Recent Uploads</div>
          <div className="space-y-2">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
