import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import { useBatchVideos } from '../../hooks/useVideos'
import type { DanceStyle, Video } from '../../types'
import { formatDateDDMMYYYY } from '../../utils/dates'

const filters: (DanceStyle | 'All')[] = ['All', 'Bollywood', 'Western', 'Fusion']

const styleColors: Record<string, string> = {
  Bollywood: 'bg-[#FF6F00]/20 text-[#FF6F00]',
  Western: 'bg-[#00BCD4]/20 text-[#00BCD4]',
  Fusion: 'bg-[#7B2D8B]/20 text-[#7B2D8B]',
}

function VideoCard({ video }: { video: Video }) {
  const url = video.storageUrl || (video as any).url || ''

  function handleWatch() {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="bg-white/5 rounded-xl p-3 flex gap-3 items-center">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#7B2D8B] to-[#E91E8C] flex items-center justify-center text-xl flex-shrink-0">
        ▶
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{video.title}</div>
        <div className="flex items-center gap-2 mt-1">
          {video.style && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${styleColors[video.style] || ''}`}>
              {video.style}
            </span>
          )}
          <span className="text-[10px] text-white/40">{formatDateDDMMYYYY(video.uploadedAt)}</span>
        </div>
      </div>
      {url && (
        <button
          onClick={handleWatch}
          className="text-xs bg-[#00BCD4]/20 text-[#00BCD4] px-3 py-1.5 rounded-full flex-shrink-0 hover:bg-[#00BCD4]/30 transition-colors"
        >
          Watch
        </button>
      )}
    </div>
  )
}

export function VideoLibrary() {
  const { user } = useAuth()
  const { student } = useStudent(user?.uid)
  const [activeFilter, setActiveFilter] = useState<DanceStyle | 'All'>('All')
  const { videos, loading } = useBatchVideos(
    student?.batchIds || [],
    activeFilter === 'All' ? undefined : activeFilter
  )

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

      {loading ? (
        <div className="text-white/30 text-sm">Loading...</div>
      ) : (
        <div className="space-y-2">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
          {videos.length === 0 && <p className="text-white/30 text-sm">No videos available</p>}
        </div>
      )}
    </div>
  )
}
