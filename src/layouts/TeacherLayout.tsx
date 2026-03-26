import { NavLink, Outlet } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { OfflineBanner } from '../components/OfflineBanner'

const tabs = [
  { to: '/teacher/dashboard', label: 'Home', icon: '🏠' },
  { to: '/teacher/batches', label: 'Batches', icon: '📋' },
  { to: '/teacher/students', label: 'Students', icon: '👥' },
  { to: '/teacher/videos', label: 'Videos', icon: '🎬' },
]

export function TeacherLayout() {
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <AppHeader />
      <OfflineBanner />
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-[#1A1A2E] border-t border-white/10 max-w-lg mx-auto">
        <div className="flex justify-around py-2">
          {tabs.map((tab) => (
            <NavLink key={tab.to} to={tab.to}
              className={({ isActive }) => `flex flex-col items-center py-1 px-3 text-xs ${isActive ? 'text-[#00BCD4]' : 'text-white/40'}`}>
              <span className="text-lg">{tab.icon}</span>
              <span className="mt-0.5">{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
