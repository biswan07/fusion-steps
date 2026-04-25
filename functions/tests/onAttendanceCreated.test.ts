import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { installAdminMock, makeDoc, makeQuerySnap, makeChange } from './helpers'

function extractHandler(fn: unknown): (snap: unknown, ctx: unknown) => Promise<unknown> {
  const obj = fn as { run?: (snap: unknown, ctx: unknown) => Promise<unknown> }
  if (typeof obj.run === 'function') return obj.run
  return fn as (snap: unknown, ctx: unknown) => Promise<unknown>
}

describe('onAttendanceCreated — isBackdated', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('firebase-admin')
  })

  it('does NOT send any FCM message when isBackdated is true', async () => {
    const subDoc = makeDoc('sub-1', {
      packSize: 10,
      classesRemaining: 5,
      isActive: true,
      studentId: 'student-1',
      editHistory: [],
    })
    const userDoc = makeDoc('student-1', { fcmToken: 'token-abc' })

    const admin = installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue(makeQuerySnap([subDoc])),
        })),
        doc: vi.fn((path: string) => {
          if (path === 'users/student-1') return { get: async () => userDoc }
          throw new Error('unexpected doc path: ' + path)
        }),
      }),
    })

    const { onAttendanceCreated } = await import('../src/onAttendanceCreated')
    const handler = extractHandler(onAttendanceCreated)

    const change = makeChange({
      status: 'present',
      studentId: 'student-1',
      batchName: 'Tuesday Bollywood',
      date: { toDate: () => new Date('2026-04-20T10:00:00Z') },
      isBackdated: true,
      markedBy: 'teacher-1',
    })

    await handler(change, { params: { attendanceId: 'a1' } })

    expect(admin.messagingSend).not.toHaveBeenCalled()
  })

  it('still decrements classesRemaining FIFO when isBackdated is true', async () => {
    let captured: Record<string, unknown> | null = null
    const subDoc = makeDoc(
      'sub-1',
      { packSize: 10, classesRemaining: 5, isActive: true, studentId: 'student-1', editHistory: [] },
      (patch) => { captured = patch }
    )
    const userDoc = makeDoc('student-1', { fcmToken: 'token-abc' })

    installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue(makeQuerySnap([subDoc])),
        })),
        doc: vi.fn(() => ({ get: async () => userDoc })),
      }),
    })

    const { onAttendanceCreated } = await import('../src/onAttendanceCreated')
    const handler = extractHandler(onAttendanceCreated)

    const change = makeChange({
      status: 'present',
      studentId: 'student-1',
      batchName: 'X',
      date: { toDate: () => new Date('2026-04-20T10:00:00Z') },
      isBackdated: true,
      markedBy: 'teacher-1',
    })
    await handler(change, { params: { attendanceId: 'a1' } })

    expect(subDoc.ref.update).toHaveBeenCalledTimes(1)
    expect(captured!.classesRemaining).toBe(4)
  })

  it('appends a backdate-dates entry to editHistory when isBackdated is true', async () => {
    let captured: Record<string, unknown> | null = null
    const subDoc = makeDoc(
      'sub-1',
      { packSize: 10, classesRemaining: 7, isActive: true, studentId: 'student-1', editHistory: [] },
      (patch) => { captured = patch }
    )
    const userDoc = makeDoc('student-1', { fcmToken: 'token-abc' })

    installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue(makeQuerySnap([subDoc])),
        })),
        doc: vi.fn(() => ({ get: async () => userDoc })),
      }),
    })

    const { onAttendanceCreated } = await import('../src/onAttendanceCreated')
    const handler = extractHandler(onAttendanceCreated)

    const dateValue = { toDate: () => new Date('2026-04-15T10:00:00Z') }
    await handler(
      makeChange({
        status: 'present',
        studentId: 'student-1',
        batchName: 'X',
        date: dateValue,
        isBackdated: true,
        markedBy: 'teacher-1',
      }),
      { params: { attendanceId: 'a1' } }
    )

    const eh = captured!.editHistory as { __arrayUnion: unknown[] }
    expect(eh.__arrayUnion).toHaveLength(1)
    const entry = eh.__arrayUnion[0] as Record<string, unknown>
    expect(entry.action).toBe('backdate-dates')
    expect(entry.editedBy).toBe('teacher-1')
    expect(entry.oldValue).toEqual({ packSize: 10, classesRemaining: 7 })
    expect(entry.newValue).toEqual({ packSize: 10, classesRemaining: 6 })
    expect(entry.dates).toEqual([dateValue])
  })

  it('still sends FCM and does NOT touch editHistory when isBackdated is falsy', async () => {
    let captured: Record<string, unknown> | null = null
    const subDoc = makeDoc(
      'sub-1',
      { packSize: 10, classesRemaining: 2, isActive: true, studentId: 'student-1', editHistory: [] },
      (patch) => { captured = patch }
    )
    const userDoc = makeDoc('student-1', { fcmToken: 'token-abc' })

    const admin = installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue(makeQuerySnap([subDoc])),
        })),
        doc: vi.fn(() => ({ get: async () => userDoc })),
      }),
    })

    const { onAttendanceCreated } = await import('../src/onAttendanceCreated')
    const handler = extractHandler(onAttendanceCreated)

    await handler(
      makeChange({
        status: 'present',
        studentId: 'student-1',
        batchName: 'Tuesday',
        date: { toDate: () => new Date('2026-04-20T10:00:00Z') },
        markedBy: 'teacher-1',
      }),
      { params: { attendanceId: 'a1' } }
    )

    // Regression: 2 remaining triggers low-balance + receipt = 2 sends.
    expect(admin.messagingSend).toHaveBeenCalledTimes(2)
    expect(captured!.classesRemaining).toBe(1)
    expect(captured!.editHistory).toBeUndefined()
  })
})
