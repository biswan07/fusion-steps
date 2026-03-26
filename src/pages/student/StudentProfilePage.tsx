import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { useStudentBatches } from '../../hooks/useBatches'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'

export function StudentProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { student } = useStudent(user?.uid)
  const { subscription } = useActiveSubscription(user?.uid)
  const { batches } = useStudentBatches(student?.batchIds || [])

  async function handleSignOut() {
    if (!auth) return
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00BCD4] to-[#7B2D8B] flex items-center justify-center text-2xl font-bold mx-auto">
          {student?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="text-lg font-semibold mt-3">{student?.name}</div>
        <div className="text-sm text-white/50">{student?.email}</div>
        {student?.phone && <div className="text-sm text-white/50">{student.phone}</div>}
      </div>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Subscription</div>
        {subscription ? (
          <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm">{subscription.packSize}-class pack</span>
            <SubscriptionBadge classesRemaining={subscription.classesRemaining} />
          </div>
        ) : (
          <p className="text-white/30 text-sm">No active subscription</p>
        )}
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">My Batches</div>
        <div className="space-y-2">
          {batches.map((b) => (
            <div key={b.id} className="bg-white/5 rounded-xl p-3.5">
              <div className="text-sm font-medium">{b.name}</div>
              <div className="text-xs text-white/50 mt-0.5">{b.dayOfWeek} · {b.time}</div>
            </div>
          ))}
          {batches.length === 0 && <p className="text-white/30 text-sm">Not enrolled in any batches</p>}
        </div>
      </section>

      <button onClick={handleSignOut}
        className="w-full bg-white/5 border border-white/10 text-white/60 rounded-xl py-2.5 text-sm">
        Sign Out
      </button>
    </div>
  )
}
