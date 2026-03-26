import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types'

interface Props {
  requiredRole: UserRole
  children: React.ReactNode
}

export function ProtectedRoute({ requiredRole, children }: Props) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-[#00BCD4] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (role !== requiredRole) {
    const redirect = role === 'teacher' ? '/teacher/dashboard' : '/student/home'
    return <Navigate to={redirect} replace />
  }

  return <>{children}</>
}
