import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import { useBatchVideos } from '../../hooks/useVideos'
import { VideoCard } from '../../components/VideoCard'
import type { DanceStyle } from '../../types'

const filters: (DanceStyle | 'All')[] = ['All', 'Bollywood', 'Western', 'Fusion']

export function VideoLibrary() {
  const { user } = useAuth()
  const { student } = useStudent(user?.uid)
  const [activeFilter, setActiveFilter] = useState<DanceStyle | 'All'>('All')
  const { videos, loading } = useBatchVideos(
    student?.batchIds || [],
    activeFilter === 'All' ? undefined : activeFilter
  )
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Videos</h2>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              activeFilter === f ? 'bg-[#00BCD4] text-white' : 'bg-white/5 text-white/50'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {playingUrl && (
        <div className="rounded-xl overflow-hidden bg-black">
          <video src={playingUrl} controls autoPlay className="w-full max-h-64" />
          <button onClick={() => setPlayingUrl(null)} className="w-full py-2 text-xs text-white/50">Close</button>
        </div>
      )}

      {loading ? (
        <div className="text-white/30 text-sm">Loading...</div>
      ) : (
        <div className="space-y-2">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} onPlay={(v) => setPlayingUrl(v.storageUrl)} />
          ))}
          {videos.length === 0 && <p className="text-white/30 text-sm">No videos available</p>}
        </div>
      )}
    </div>
  )
}
