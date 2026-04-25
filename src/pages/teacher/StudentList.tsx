import { useState } from 'react'
import { Link } from 'react-router-dom'
import { httpsCallable, getFunctions } from 'firebase/functions'
import { useStudents } from '../../hooks/useStudents'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'
import { StudentCategory, EnrollmentType } from '../../types'

/** Convert a phone number to the synthetic Firebase email used for phone-based accounts */
function phoneToSyntheticEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `phone_${digits}@fusionsteps.app`
}

export function StudentList() {
  const { students, loading } = useStudents()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const filtered = students.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    )
  })

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

      <input type="text" placeholder="Search by name, email or phone..." value={search}
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

function StudentRow({ student }: { student: { id: string; name: string; email: string; phone?: string } }) {
  const { subscription } = useActiveSubscription(student.id)
  return (
    <Link to={`/teacher/students/${student.id}`} className="bg-white/5 rounded-xl p-3.5 flex justify-between items-center block">
      <div>
        <div className="text-sm font-medium">{student.name}</div>
        <div className="text-xs text-white/40 mt-0.5">
          {student.email || student.phone || '—'}
        </div>
      </div>
      {subscription && <SubscriptionBadge classesRemaining={subscription.classesRemaining} />}
    </Link>
  )
}

const FEE_TABLE: Record<StudentCategory, Record<EnrollmentType, string>> = {
  Children: { Term: '$150 (10 classes)', Casual: '$18/class' },
  Teen:     { Term: '$150 (10 classes)', Casual: '$18/class' },
  Women:    { Term: '$200 (10 classes)', Casual: '$23/class' },
}

function AddStudentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [category, setCategory] = useState<StudentCategory>('Women')
  const [enrollmentType, setEnrollmentType] = useState<EnrollmentType>('Term')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isMinor = category === 'Children' || category === 'Teen'
  const fee = FEE_TABLE[category][enrollmentType]

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email && !phone) {
      setError('Please provide at least an email or phone number')
      return
    }
    setSaving(true)
    setError('')
    try {
      // If no email provided, generate a synthetic one from the phone number
      const effectiveEmail = email.trim() || phoneToSyntheticEmail(phone)

      const functions = getFunctions()
      const createStudent = httpsCallable(functions, 'createStudent')
      await createStudent({
        name,
        email: effectiveEmail,
        phone,
        studentCategory: category,
        enrollmentType,
        parentName: isMinor ? parentName : '',
        parentPhone: isMinor ? parentPhone : '',
      })
      setSaving(false)
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create student')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 rounded-xl p-4 space-y-3">
      {/* Full name */}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required
        className={inputClass} />

      {/* Student Category */}
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as StudentCategory)}
        required
        className="w-full bg-[#1A1A2E] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00BCD4]"
      >
        <option value="Women">Women</option>
        <option value="Teen">Teen</option>
        <option value="Children">Children (under 10)</option>
      </select>

      {/* Email — optional, placeholder adapts */}
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={isMinor ? 'Parent/Guardian email (optional)' : 'Email (optional if phone provided)'}
        type="email"
        className={inputClass}
      />

      {/* Phone — optional if email provided */}
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (optional if email provided)"
        type="tel"
        className={inputClass}
      />

      {/* Parent/Guardian fields — only for Children or Teen */}
      {isMinor && (
        <>
          <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Parent/Guardian name" required
            className={inputClass} />
          <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="Parent/Guardian phone" type="tel" required
            className={inputClass} />
        </>
      )}

      {/* Enrollment Type toggle */}
      <div className="flex gap-2">
        {(['Term', 'Casual'] as EnrollmentType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setEnrollmentType(type)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              enrollmentType === type
                ? 'bg-[#7B2D8B] border-[#7B2D8B] text-white'
                : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
            }`}
          >
            {type === 'Term' ? 'Term (10 classes)' : 'Casual'}
          </button>
        ))}
      </div>

      {/* Fee display — read-only */}
      <div className="flex justify-between items-center px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
        <span className="text-xs text-white/40">Fee</span>
        <span className="text-sm font-semibold text-[#00BCD4]">{fee}</span>
      </div>

      {error && <p className="text-[#E91E8C] text-xs">{error}</p>}
      <button type="submit" disabled={saving}
        className="w-full bg-[#00BCD4] text-white font-medium rounded-lg py-2 text-sm disabled:opacity-50">
        {saving ? 'Creating...' : 'Create Student'}
      </button>
    </form>
  )
}
