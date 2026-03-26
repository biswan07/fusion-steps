import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null
  return (
    <div className="bg-[#FF6F00] text-white text-center text-sm py-1.5 px-4">
      You're offline — viewing cached data
    </div>
  )
}
