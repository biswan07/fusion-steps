import { useState } from 'react'
import { Link } from 'react-router-dom'
import { httpsCallable, getFunctions } from 'firebase/functions'
import { useStudents } from '../../hooks/useStudents'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'

export function StudentList() {
  const { students, loading } = useStudents()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Students</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-[#FF6F00] text-white text-xs px-3 py-1.5 rounded-full font-medium">
          {showForm ? 'Cancel' : '+ Add Student'}
        </button>
      </div>

      {showForm && <AddStudentForm onCreated={() => setShowForm(false)} />}

      <input type="text" placeholder="Search students..." value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />

      <div className="space-y-2">
        {filtered.map((student) => (
          <StudentRow key={student.id} student={student} />
        ))}
        {filtered.length === 0 && <p className="text-white/30 text-sm">No students found</p>}
      </div>
    </div>
  )
}

function StudentRow({ student }: { student: { id: string; name: string; email: string } }) {
  const { subscription } = useActiveSubscription(student.id)
  return (
    <Link to={`/teacher/students/${student.id}`} className="bg-white/5 rounded-xl p-3.5 flex justify-between items-center block">
      <div>
        <div className="text-sm font-medium">{student.name}</div>
        <div className="text-xs text-white/40 mt-0.5">{student.email}</div>
      </div>
      {subscription && <SubscriptionBadge classesRemaining={subscription.classesRemaining} />}
    </Link>
  )
}

function AddStudentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const functions = getFunctions()
      const createStudent = httpsCallable(functions, 'createStudent')
      await createStudent({ name, email, phone })
      setSaving(false)
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create student')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 rounded-xl p-4 space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
      {error && <p className="text-[#E91E8C] text-xs">{error}</p>}
      <button type="submit" disabled={saving}
        className="w-full bg-[#00BCD4] text-white font-medium rounded-lg py-2 text-sm disabled:opacity-50">
        {saving ? 'Creating...' : 'Create Student'}
      </button>
    </form>
  )
}
