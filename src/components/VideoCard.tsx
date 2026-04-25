import type { Video } from '../types'
import { formatDateDDMMYYYY } from '../utils/dates'

const styleColors: Record<string, string> = {
  Bollywood: 'bg-[#FF6F00]/20 text-[#FF6F00]',
  Western: 'bg-[#00BCD4]/20 text-[#00BCD4]',
  Fusion: 'bg-[#7B2D8B]/20 text-[#7B2D8B]',
}

interface Props {
  video: Video
  onPlay?: (video: Video) => void
}

export function VideoCard({ video, onPlay }: Props) {
  function handleClick() {
    if (video.storageUrl.includes('firebasestorage.googleapis.com')) {
      onPlay?.(video)
    } else {
      window.open(video.storageUrl, '_blank', 'noopener')
    }
  }

  return (
    <div className="bg-white/5 rounded-xl p-3 flex gap-3 items-center cursor-pointer active:bg-white/10"
      onClick={handleClick}>
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#7B2D8B] to-[#E91E8C] flex items-center justify-center text-xl flex-shrink-0">
        ▶
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{video.title}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${styleColors[video.style]}`}>
            {video.style}
          </span>
          <span className="text-[10px] text-white/40">{formatDateDDMMYYYY(video.uploadedAt)}</span>
        </div>
      </div>
    </div>
  )
}
