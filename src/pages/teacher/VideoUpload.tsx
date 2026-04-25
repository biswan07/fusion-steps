import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useBatches } from '../../hooks/useBatches'
import type { DanceStyle } from '../../types'

export function VideoUpload() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { batches } = useBatches()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState<DanceStyle>('Bollywood')
  const [selectedBatches, setSelectedBatches] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleBatch(batchId: string) {
    setSelectedBatches((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    )
  }

  async function handleSave() {
    if (!db || !user || !videoUrl || !title) return
    if (selectedBatches.length === 0) {
      setError('Please select at least one batch')
      return
    }
    setSaving(true)
    setError('')

    try {
      await addDoc(collection(db, 'videos'), {
        title, description, style,
        batchIds: selectedBatches,
        storageUrl: videoUrl,
        thumbnailUrl: '',
        uploadedBy: user.uid,
        uploadedAt: serverTimestamp(),
      })
      navigate('/teacher/videos')
    } catch (err: any) {
      setError(err.message || 'Failed to save video')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Add Video</h2>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" required
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />

      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4] resize-none" />

      <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="Paste video link (Google Photos, YouTube, etc.)"
        type="url"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />

      <select value={style} onChange={(e) => setStyle(e.target.value as DanceStyle)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00BCD4]">
        <option value="Bollywood" className="bg-[#1A1A2E]">Bollywood</option>
        <option value="Western" className="bg-[#1A1A2E]">Western</option>
        <option value="Fusion" className="bg-[#1A1A2E]">Fusion</option>
      </select>

      <div>
        <div className="text-xs text-white/50 mb-2">Visible to batches (select at least one):</div>
        <div className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <button key={b.id} type="button" onClick={() => toggleBatch(b.id)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                selectedBatches.includes(b.id) ? 'bg-[#00BCD4] text-white' : 'bg-white/5 text-white/50'
              }`}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-[#E91E8C] text-sm">{error}</p>}

      <button onClick={handleSave} disabled={!videoUrl || !title || selectedBatches.length === 0 || saving}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50">
        {saving ? 'Saving...' : 'Add Video'}
      </button>
    </div>
  )
}
