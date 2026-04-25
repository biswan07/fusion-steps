interface Props {
  packSize: number
  classesRemaining: number
}

export function PunchCard({ packSize, classesRemaining }: Props) {
  const used = packSize - classesRemaining

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: packSize }, (_, i) => {
          const isUsed = i < used
          return (
            <div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                isUsed
                  ? 'bg-[#FF6F00]/20 text-[#FF6F00] border-2 border-[#FF6F00]/40'
                  : 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40'
              }`}
            >
              {i + 1}
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-3 text-[10px] text-white/50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF6F00]/20 border border-[#FF6F00]/40" />
          Used ({used})
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
          Remaining ({classesRemaining})
        </div>
      </div>
    </div>
  )
}
