import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mockBatchCommit = vi.fn().mockResolvedValue(undefined)
const mockBatchSet = vi.fn()
const mockBatchUpdate = vi.fn()
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] })

vi.mock('../../../src/firebase', () => ({
  db: {},
  isFirebaseConfigured: true,
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  doc: vi.fn(() => ({ id: 'new-doc-id' })),
  serverTimestamp: vi.fn(() => 'TS'),
  query: vi.fn((...args) => args),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  writeBatch: () => ({
    set: mockBatchSet,
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  }),
  Timestamp: {
    now: () => ({ __ts: 'now' }),
    fromDate: (d: Date) => ({ __ts: d.toISOString() }),
  },
}))

vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'teacher-1' } }),
}))

vi.mock('../../../src/hooks/useStudents', () => ({
  useStudent: () => ({
    student: { id: 'student-1', name: 'Anika', studentCategory: 'Children' },
    loading: false,
  }),
}))

import { AssignSubscription } from '../../../src/pages/teacher/AssignSubscription'

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/teacher/students/student-1/subscribe']}>
      <Routes>
        <Route path="/teacher/students/:studentId/subscribe" element={<AssignSubscription />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AssignSubscription — backdate by count', () => {
  beforeEach(() => {
    mockBatchCommit.mockClear()
    mockBatchSet.mockClear()
    mockBatchUpdate.mockClear()
    mockGetDocs.mockReset().mockResolvedValue({ docs: [] })
  })

  it('writes a sub with classesRemaining = packSize − used', async () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: /10 classes/i }))
    fireEvent.click(screen.getByRole('button', { name: /already attended/i }))
    fireEvent.click(screen.getByRole('tab', { name: /by count/i }))
    fireEvent.change(screen.getByLabelText(/already used/i), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /assign pack/i }))

    await waitFor(() => expect(mockBatchCommit).toHaveBeenCalled())
    const setCall = mockBatchSet.mock.calls.find(([_, p]) => p?.packSize === 10)
    expect(setCall).toBeDefined()
    expect(setCall![1].classesRemaining).toBe(7)
    expect(setCall![1].isActive).toBe(true)
    expect(setCall![1].editHistory).toEqual([
      expect.objectContaining({
        action: 'backdate-count',
        oldValue: { packSize: 10, classesRemaining: 10 },
        newValue: { packSize: 10, classesRemaining: 7 },
        editedBy: 'teacher-1',
      }),
    ])
  })

  it('flips isActive=false when usedCount equals packSize', async () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: /5 classes/i }))
    fireEvent.click(screen.getByRole('button', { name: /already attended/i }))
    fireEvent.click(screen.getByRole('tab', { name: /by count/i }))
    fireEvent.change(screen.getByLabelText(/already used/i), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /assign pack/i }))

    await waitFor(() => expect(mockBatchCommit).toHaveBeenCalled())
    const setCall = mockBatchSet.mock.calls.find(([_, p]) => p?.packSize === 5)
    expect(setCall![1].classesRemaining).toBe(0)
    expect(setCall![1].isActive).toBe(false)
  })
})

describe('AssignSubscription — backdate by date', () => {
  beforeEach(() => {
    mockBatchCommit.mockClear()
    mockBatchSet.mockClear()
    mockBatchUpdate.mockClear()
    mockGetDocs.mockReset().mockResolvedValue({ docs: [] })
  })

  it('creates one isBackdated attendance doc per added date and a full pack', async () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: /10 classes/i }))
    fireEvent.click(screen.getByRole('button', { name: /already attended/i }))
    // Default tab is "By date".

    fireEvent.change(screen.getByLabelText(/add date/i), { target: { value: '2026-04-20' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.change(screen.getByLabelText(/add date/i), { target: { value: '2026-04-21' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    fireEvent.click(screen.getByRole('button', { name: /assign pack/i }))

    await waitFor(() => expect(mockBatchCommit).toHaveBeenCalled())
    const attendanceWrites = mockBatchSet.mock.calls.filter(
      ([_, p]) => p?.isBackdated === true
    )
    expect(attendanceWrites).toHaveLength(2)
    attendanceWrites.forEach(([, p]) => {
      expect(p.status).toBe('present')
      expect(p.markedBy).toBe('teacher-1')
    })

    const subWrite = mockBatchSet.mock.calls.find(([_, p]) => p?.packSize === 10)
    expect(subWrite![1].classesRemaining).toBe(10)
  })
})
