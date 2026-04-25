import { useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useBatches } from '../../hooks/useBatches'
import { BatchCard } from '../../components/BatchCard'
import type { DanceStyle, BatchLevel } from '../../types'

export function BatchList() {
  const { batches, loading } = useBatches(false)
  const [showForm, setShowForm] = useState(false)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Batches</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-[#FF6F00] text-white text-xs px-3 py-1.5 rounded-full font-medium">
          {showForm ? 'Cancel' : '+ New Batch'}
        </button>
      </div>

      {showForm && <CreateBatchForm onCreated={() => setShowForm(false)} />}

      <div className="space-y-2">
        {batches.map((batch) => (
          <div key={batch.id} className="relative">
            <Link to={`/teacher/batches/${batch.id}`}>
              <BatchCard batch={batch} />
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (window.confirm(`Delete "${batch.name}"? This cannot be undone.`)) {
                  deleteDoc(doc(db!, 'batches', batch.id))
                }
              }}
              className="absolute top-3 right-3 text-white/30 hover:text-[#E91E8C] text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateBatchForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('Monday')
  const [time, setTime] = useState('')
  const [style, setStyle] = useState<DanceStyle>('Bollywood')
  const [level, setLevel] = useState<BatchLevel>('Beginner')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!db) return
    setSaving(true)
    setError('')
    try {
      await addDoc(collection(db, 'batches'), {
        name, dayOfWeek, time, style, level,
        studentIds: [], isActive: true, createdAt: serverTimestamp(),
      })
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create batch')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 rounded-xl p-4 space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Batch name" required
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
      <div className="grid grid-cols-2 gap-3">
        <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00BCD4]">
          {days.map((d) => <option key={d} value={d} className="bg-[#1A1A2E]">{d}</option>)}
        </select>
        <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 6:00 PM" required
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select value={style} onChange={(e) => setStyle(e.target.value as DanceStyle)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00BCD4]">
          <option value="Bollywood" className="bg-[#1A1A2E]">Bollywood</option>
          <option value="Western" className="bg-[#1A1A2E]">Western</option>
          <option value="Fusion" className="bg-[#1A1A2E]">Fusion</option>
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value as BatchLevel)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00BCD4]">
          <option value="Beginner" className="bg-[#1A1A2E]">Beginner</option>
          <option value="Intermediate" className="bg-[#1A1A2E]">Intermediate</option>
          <option value="Advanced" className="bg-[#1A1A2E]">Advanced</option>
        </select>
      </div>
      {error && <p className="text-[#E91E8C] text-xs">{error}</p>}
      <button type="submit" disabled={saving}
        className="w-full bg-[#00BCD4] text-white font-medium rounded-lg py-2 text-sm disabled:opacity-50">
        {saving ? 'Creating...' : 'Create Batch'}
      </button>
    </form>
  )
}
