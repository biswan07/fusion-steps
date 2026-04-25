import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mockCallEditSubscription = vi.fn().mockResolvedValue({ data: { ok: true } })

vi.mock('../../../src/lib/callables', () => ({
  callEditSubscription: (...args: unknown[]) => mockCallEditSubscription(...args),
}))

vi.mock('../../../src/firebase', () => ({ db: {}, isFirebaseConfigured: true }))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  doc: vi.fn(() => ({ id: 'x' })),
  arrayUnion: vi.fn((x) => ({ __arrayUnion: x })),
  arrayRemove: vi.fn((x) => ({ __arrayRemove: x })),
  serverTimestamp: vi.fn(() => 'TS'),
  writeBatch: () => ({ update: vi.fn(), set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) }),
  addDoc: vi.fn().mockResolvedValue({ id: 'attendance-id' }),
}))

vi.mock('../../../src/hooks/useStudents', () => ({
  useStudent: () => ({
    student: { id: 'student-1', name: 'Anika', email: 'a@x.com', batchIds: [] },
    loading: false,
  }),
}))

vi.mock('../../../src/hooks/useAttendance', () => ({
  useStudentAttendance: () => ({ records: [] }),
}))

vi.mock('../../../src/hooks/useBatches', () => ({
  useBatches: () => ({ batches: [] }),
}))

vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'teacher-1' } }),
}))

const editedAt = new Date('2026-04-25T08:30:00+10:00')
vi.mock('../../../src/hooks/useSubscriptions', () => ({
  useStudentSubscriptions: () => ({
    subscriptions: [{
      id: 'sub-1', studentId: 'student-1', studentName: 'Anika',
      packSize: 5, classesRemaining: 3, isActive: true,
      assignedBy: 'teacher-1', assignedAt: new Date('2026-04-01'),
      editHistory: [
        { action: 'resize', editedBy: 'teacher-1', editedAt,
          oldValue: { packSize: 5, classesRemaining: 5 },
          newValue: { packSize: 10, classesRemaining: 10 } },
      ],
    }],
  }),
}))

import { StudentProfile } from '../../../src/pages/teacher/StudentProfile'

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/teacher/students/student-1']}>
      <Routes>
        <Route path="/teacher/students/:studentId" element={<StudentProfile />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('StudentProfile — edit pack', () => {
  beforeEach(() => { mockCallEditSubscription.mockClear() })

  it('opens the edit dialog and submits resize via editSubscription', async () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: /edit pack/i }))
    fireEvent.change(screen.getByLabelText(/new pack size/i), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(mockCallEditSubscription).toHaveBeenCalled())
    expect(mockCallEditSubscription).toHaveBeenCalledWith({
      subscriptionId: 'sub-1',
      op: 'resize',
      newPackSize: 10,
      newClassesRemaining: 8,
    })
  })
})

describe('StudentProfile — backdate on existing pack', () => {
  beforeEach(() => { mockCallEditSubscription.mockClear() })

  it('submits backdate-count via editSubscription', async () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: /add past attendance/i }))
    fireEvent.change(screen.getByLabelText(/already used/i), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(mockCallEditSubscription).toHaveBeenCalled())
    expect(mockCallEditSubscription).toHaveBeenCalledWith({
      subscriptionId: 'sub-1',
      op: 'backdate-count',
      usedCount: 2,
    })
  })
})

describe('StudentProfile — history strip', () => {
  it('renders edit history with formatted entries', () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: /history/i }))
    expect(screen.getByText(/Resized 5→10 \(remaining 5→10\)/)).toBeInTheDocument()
  })
})
