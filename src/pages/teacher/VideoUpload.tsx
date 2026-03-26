import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, storage } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useBatches } from '../../hooks/useBatches'
import type { DanceStyle } from '../../types'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

export function VideoUpload() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { batches } = useBatches()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState<DanceStyle>('Bollywood')
  const [selectedBatches, setSelectedBatches] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Please select an MP4, MOV, or WebM file')
      return
    }
    if (f.size > MAX_FILE_SIZE) {
      setError('File size must be under 500MB')
      return
    }
    setFile(f)
    setError('')
  }

  function toggleBatch(batchId: string) {
    setSelectedBatches((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    )
  }

  async function handleUpload() {
    if (!db || !storage || !user || !file) return
    setUploading(true)
    setError('')

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storageRef = ref(storage, `videos/${Date.now()}-${safeName}`)
      const task = uploadBytesResumable(storageRef, file)

      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve()
        )
      })

      const storageUrl = await getDownloadURL(storageRef)

      try {
        await addDoc(collection(db, 'videos'), {
          title, description, style,
          batchIds: selectedBatches,
          storageUrl,
          thumbnailUrl: '',
          uploadedBy: user.uid,
          uploadedAt: serverTimestamp(),
        })
        navigate('/teacher/videos')
      } catch (err: any) {
        // Clean up orphaned storage file
        try { await deleteObject(storageRef) } catch {}
        setError(err.message || 'Failed to save video details — upload rolled back')
        setUploading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed — try again')
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Upload Video</h2>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" required
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />

      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4] resize-none" />

      <select value={style} onChange={(e) => setStyle(e.target.value as DanceStyle)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00BCD4]">
        <option value="Bollywood" className="bg-[#1A1A2E]">Bollywood</option>
        <option value="Western" className="bg-[#1A1A2E]">Western</option>
        <option value="Fusion" className="bg-[#1A1A2E]">Fusion</option>
      </select>

      <div>
        <div className="text-xs text-white/50 mb-2">Visible to batches:</div>
        <div className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <button key={b.id} onClick={() => toggleBatch(b.id)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                selectedBatches.includes(b.id) ? 'bg-[#00BCD4] text-white' : 'bg-white/5 text-white/50'
              }`}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm"
          onChange={handleFileSelect} className="hidden" />
        <button onClick={() => fileRef.current?.click()}
          className="w-full bg-white/5 border-2 border-dashed border-white/20 rounded-xl py-8 text-center text-sm text-white/50">
          {file ? file.name : 'Tap to select video (MP4, MOV, WebM — max 500MB)'}
        </button>
      </div>

      {uploading && (
        <div className="w-full bg-white/10 rounded-full h-2">
          <div className="bg-[#00BCD4] h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="text-[#E91E8C] text-sm">{error}</p>}

      <button onClick={handleUpload} disabled={!file || !title || uploading}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50">
        {uploading ? `Uploading ${progress}%...` : 'Upload Video'}
      </button>
    </div>
  )
}
