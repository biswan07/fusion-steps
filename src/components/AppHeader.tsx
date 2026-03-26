import { useAuth } from '../hooks/useAuth'

export function AppHeader() {
  const { user } = useAuth()
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
      <div className="flex items-center gap-3">
        <img src="/assets/icon-72x72.png" alt="Fusion Steps" className="w-9 h-9 rounded-full" />
        <div>
          <div className="font-['Dancing_Script'] text-lg text-[#00BCD4]">Fusion Steps</div>
          <div className="text-[10px] text-white/50">by Sriparna Dutta</div>
        </div>
      </div>
      {user && (
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
          {user.email?.[0].toUpperCase() || '?'}
        </div>
      )}
    </header>
  )
}
