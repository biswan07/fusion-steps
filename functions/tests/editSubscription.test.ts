import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installAdminMock, makeDoc } from './helpers'

type PackSize = 1 | 5 | 10 | 20

function extractHandler(fn: unknown): (data: unknown, ctx: unknown) => Promise<unknown> {
  const obj = fn as { run?: (data: unknown, ctx: unknown) => Promise<unknown> }
  if (typeof obj.run === 'function') return obj.run
  return fn as (data: unknown, ctx: unknown) => Promise<unknown>
}

const VALID_RESIZE = {
  subscriptionId: 'sub-1',
  op: 'resize' as const,
  newPackSize: 10 as const,
  newClassesRemaining: 8,
}

describe('editSubscription — auth gate', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('firebase-admin')
  })

  it('rejects unauthenticated callers', async () => {
    installAdminMock({ firestoreImpl: () => ({ collection: vi.fn(), doc: vi.fn() }) })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = extractHandler(editSubscription)
    await expect(handler(VALID_RESIZE, {})).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('rejects callers whose role is not teacher', async () => {
    const callerDoc = makeDoc('user-x', { role: 'student' })
    installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(),
        doc: vi.fn(() => ({ get: async () => callerDoc })),
      }),
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = extractHandler(editSubscription)
    await expect(handler(VALID_RESIZE, { auth: { uid: 'user-x' } })).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })
})

function installResizeMock(opts: {
  caller?: { role: string }
  sub: Record<string, unknown>
}) {
  const teacherDoc = makeDoc('teacher-1', opts.caller ?? { role: 'teacher' })
  const subDoc = makeDoc('sub-1', opts.sub)
  let captured: Record<string, unknown> | null = null
  installAdminMock({
    firestoreImpl: () => ({
      collection: vi.fn(),
      doc: vi.fn((path: string) => {
        if (path === 'users/teacher-1') return { get: async () => teacherDoc }
        if (path === 'subscriptions/sub-1') return subDoc.ref
        throw new Error('unexpected path: ' + path)
      }),
      runTransaction: vi.fn(async (fn: (txn: unknown) => Promise<unknown>) =>
        fn({
          get: async () => subDoc,
          update: (_ref: unknown, patch: Record<string, unknown>) => { captured = patch },
        })
      ),
    }),
  })
  return { getCaptured: () => captured, subDoc }
}

describe('editSubscription — resize', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('firebase-admin')
  })

  it('updates packSize, classesRemaining, isActive and appends editHistory', async () => {
    const { getCaptured } = installResizeMock({
      sub: { packSize: 5, classesRemaining: 3, isActive: true, studentId: 'student-1' },
    })

    const { editSubscription } = await import('../src/editSubscription')
    const handler = extractHandler(editSubscription)

    await handler(
      { subscriptionId: 'sub-1', op: 'resize', newPackSize: 10, newClassesRemaining: 8 },
      { auth: { uid: 'teacher-1' } }
    )

    const patch = getCaptured()!
    expect(patch.packSize).toBe(10)
    expect(patch.classesRemaining).toBe(8)
    expect(patch.isActive).toBe(true)
    const eh = patch.editHistory as { __arrayUnion: unknown[] }
    const entry = eh.__arrayUnion[0] as Record<string, unknown>
    expect(entry.action).toBe('resize')
    expect(entry.editedBy).toBe('teacher-1')
    expect(entry.oldValue).toEqual({ packSize: 5, classesRemaining: 3 })
    expect(entry.newValue).toEqual({ packSize: 10, classesRemaining: 8 })
  })

  it('flips isActive=false when newClassesRemaining is 0', async () => {
    const { getCaptured } = installResizeMock({
      sub: { packSize: 5, classesRemaining: 3, isActive: true, studentId: 'student-1' },
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = extractHandler(editSubscription)
    await handler(
      { subscriptionId: 'sub-1', op: 'resize', newPackSize: 10, newClassesRemaining: 0 },
      { auth: { uid: 'teacher-1' } }
    )
    expect(getCaptured()!.isActive).toBe(false)
  })

  it.each([
    { newPackSize: 7, newClassesRemaining: 3 },
    { newPackSize: 10, newClassesRemaining: -1 },
    { newPackSize: 10, newClassesRemaining: 11 },
    { newPackSize: 10, newClassesRemaining: 1.5 },
  ])('rejects invalid resize args %j', async (args) => {
    installResizeMock({
      sub: { packSize: 5, classesRemaining: 3, isActive: true, studentId: 'student-1' },
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = extractHandler(editSubscription)
    await expect(
      handler(
        { subscriptionId: 'sub-1', op: 'resize', newPackSize: args.newPackSize as PackSize, newClassesRemaining: args.newClassesRemaining },
        { auth: { uid: 'teacher-1' } }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

describe('editSubscription — backdate-count', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('firebase-admin')
  })

  it('decrements classesRemaining by usedCount and appends editHistory', async () => {
    const { getCaptured } = installResizeMock({
      sub: { packSize: 10, classesRemaining: 10, isActive: true, studentId: 'student-1' },
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = extractHandler(editSubscription)
    await handler(
      { subscriptionId: 'sub-1', op: 'backdate-count', usedCount: 3 },
      { auth: { uid: 'teacher-1' } }
    )
    const patch = getCaptured()!
    expect(patch.classesRemaining).toBe(7)
    expect(patch.isActive).toBe(true)
    const eh = patch.editHistory as { __arrayUnion: unknown[] }
    const entry = eh.__arrayUnion[0] as Record<string, unknown>
    expect(entry.action).toBe('backdate-count')
    expect(entry.oldValue).toEqual({ packSize: 10, classesRemaining: 10 })
    expect(entry.newValue).toEqual({ packSize: 10, classesRemaining: 7 })
  })

  it('flips isActive=false when usedCount equals classesRemaining', async () => {
    const { getCaptured } = installResizeMock({
      sub: { packSize: 5, classesRemaining: 5, isActive: true, studentId: 'student-1' },
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = extractHandler(editSubscription)
    await handler(
      { subscriptionId: 'sub-1', op: 'backdate-count', usedCount: 5 },
      { auth: { uid: 'teacher-1' } }
    )
    expect(getCaptured()!.classesRemaining).toBe(0)
    expect(getCaptured()!.isActive).toBe(false)
  })

  it('rejects usedCount exceeding classesRemaining', async () => {
    installResizeMock({
      sub: { packSize: 5, classesRemaining: 2, isActive: true, studentId: 'student-1' },
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = extractHandler(editSubscription)
    await expect(
      handler(
        { subscriptionId: 'sub-1', op: 'backdate-count', usedCount: 5 },
        { auth: { uid: 'teacher-1' } }
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' })
  })

  it.each([0, -1, 1.5, 101])('rejects usedCount=%s', async (usedCount) => {
    installResizeMock({
      sub: { packSize: 10, classesRemaining: 10, isActive: true, studentId: 'student-1' },
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = extractHandler(editSubscription)
    await expect(
      handler(
        { subscriptionId: 'sub-1', op: 'backdate-count', usedCount },
        { auth: { uid: 'teacher-1' } }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})
