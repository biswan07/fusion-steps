import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProtectedRoute } from '../../src/components/ProtectedRoute'
import { AuthContext, AuthState } from '../../src/hooks/useAuth'

function renderWithAuth(authState: AuthState, element: React.ReactElement) {
  return render(
    <AuthContext.Provider value={authState}>
      <MemoryRouter>{element}</MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('ProtectedRoute', () => {
  it('shows loading when auth is loading', () => {
    renderWithAuth(
      { user: null, role: null, loading: true },
      <ProtectedRoute requiredRole="teacher"><div>Secret</div></ProtectedRoute>
    )
    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
  })

  it('renders children when role matches', () => {
    renderWithAuth(
      { user: { uid: '1' } as any, role: 'teacher', loading: false },
      <ProtectedRoute requiredRole="teacher"><div>Teacher Content</div></ProtectedRoute>
    )
    expect(screen.getByText('Teacher Content')).toBeInTheDocument()
  })

  it('does not render children when role mismatches', () => {
    renderWithAuth(
      { user: { uid: '1' } as any, role: 'student', loading: false },
      <ProtectedRoute requiredRole="teacher"><div>Teacher Content</div></ProtectedRoute>
    )
    expect(screen.queryByText('Teacher Content')).not.toBeInTheDocument()
  })
})
