import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import type { PackSize } from '../../types'

const packs: { size: PackSize; label: string }[] = [
  { size: 5, label: '5 Classes' },
  { size: 10, label: '10 Classes' },
  { size: 20, label: '20 Classes' },
]

export function AssignSubscription() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { student, loading } = useStudent(studentId)
  const [selected, setSelected] = useState<PackSize | null>(null)
  const [saving, setSaving] = useState(false)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!student) return <div className="text-white/30 text-sm">Student not found</div>

  async function handleAssign() {
    if (!db || !user || !selected || !studentId) return
    setSaving(true)
    await addDoc(collection(db, 'subscriptions'), {
      studentId,
      studentName: student!.name,
      packSize: selected,
      classesRemaining: selected,
      assignedBy: user.uid,
      assignedAt: serverTimestamp(),
      isActive: true,
    })
    setSaving(false)
    navigate(`/teacher/students/${studentId}`)
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
            <div className="text-lg font-semibold">{pack.label}</div>
            <div className="text-xs text-white/40 mt-1">{pack.size}-class pass</div>
          </button>
        ))}
      </div>

      <button onClick={handleAssign} disabled={!selected || saving}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50">
        {saving ? 'Assigning...' : 'Assign Pack'}
      </button>
    </div>
  )
}
