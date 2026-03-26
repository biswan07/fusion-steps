import { Link } from 'react-router-dom'
import type { Batch } from '../types'

const styleBorderColors: Record<string, string> = {
  Bollywood: 'border-l-[#FF6F00]',
  Western: 'border-l-[#00BCD4]',
  Fusion: 'border-l-[#7B2D8B]',
}

interface Props {
  batch: Batch
  showMarkButton?: boolean
}

export function BatchCard({ batch, showMarkButton }: Props) {
  return (
    <div className={`bg-white/5 rounded-xl p-3.5 border-l-[3px] ${styleBorderColors[batch.style] || 'border-l-white/20'}`}>
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm font-medium">{batch.name}</div>
          <div className="text-xs text-white/50 mt-0.5">
            {batch.time} · {batch.studentIds.length} students
          </div>
        </div>
        {showMarkButton && (
          <Link to={`/teacher/batches/${batch.id}/attendance`}
            className="bg-[#FF6F00] text-white text-xs px-3 py-1 rounded-full font-medium">
            Mark
          </Link>
        )}
      </div>
    </div>
  )
}
