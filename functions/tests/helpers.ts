import { vi } from 'vitest'

// ----- Firestore stub -----------------------------------------------------

export type StubDoc<T = Record<string, unknown>> = {
  id: string
  exists: boolean
  ref: { update: ReturnType<typeof vi.fn>; get: () => Promise<StubDoc<T>> }
  data: () => T
}

export type StubQuerySnapshot<T = Record<string, unknown>> = {
  empty: boolean
  docs: StubDoc<T>[]
}

export type StubFirestore = {
  collection: ReturnType<typeof vi.fn>
  doc: ReturnType<typeof vi.fn>
  runTransaction?: ReturnType<typeof vi.fn>
}

export function makeDoc<T extends Record<string, unknown>>(
  id: string,
  data: T | null,
  updateImpl?: (patch: Record<string, unknown>) => void,
): StubDoc<T> {
  const exists = data !== null
  let current = data ?? ({} as T)
  const update = vi.fn(async (patch: Record<string, unknown>) => {
    updateImpl?.(patch)
    current = { ...current, ...patch } as T
  })
  const docObj: StubDoc<T> = {
    id,
    exists,
    ref: { update, get: async () => docObj },
    data: () => current,
  }
  return docObj
}

export function makeQuerySnap<T extends Record<string, unknown>>(
  docs: StubDoc<T>[],
): StubQuerySnapshot<T> {
  return { empty: docs.length === 0, docs }
}

// ----- Admin SDK mock factory --------------------------------------------

export type AdminMock = {
  firestore: ReturnType<typeof vi.fn>
  messagingSend: ReturnType<typeof vi.fn>
  serverTimestamp: () => string
  arrayUnion: (...x: unknown[]) => { __arrayUnion: unknown[] }
}

export function installAdminMock(opts: {
  firestoreImpl: () => StubFirestore
  messagingImpl?: () => { send: ReturnType<typeof vi.fn> }
}): AdminMock {
  const messagingSend =
    opts.messagingImpl?.().send ?? vi.fn().mockResolvedValue('msg-id')

  // firestore() is a callable that also exposes static members (FieldValue, Timestamp).
  const firestoreCallable = vi.fn(() => opts.firestoreImpl()) as unknown as Record<
    string,
    unknown
  > & ReturnType<typeof vi.fn>
  ;(firestoreCallable as Record<string, unknown>).FieldValue = {
    serverTimestamp: () => 'SERVER_TS',
    arrayUnion: (...x: unknown[]) => ({ __arrayUnion: x }),
  }
  ;(firestoreCallable as Record<string, unknown>).Timestamp = {
    now: () => ({ __timestamp: 'NOW' }),
  }

  const adminMock = {
    firestore: firestoreCallable,
    messaging: vi.fn(() => ({ send: messagingSend })),
    initializeApp: vi.fn(),
  }

  vi.doMock('firebase-admin', () => adminMock)

  // Modular admin/firestore subpath imports used by editSubscription / onAttendanceCreated.
  vi.doMock('firebase-admin/firestore', () => ({
    getFirestore: () => opts.firestoreImpl(),
    FieldValue: {
      serverTimestamp: () => 'SERVER_TS',
      arrayUnion: (...x: unknown[]) => ({ __arrayUnion: x }),
    },
    Timestamp: {
      now: () => ({ __timestamp: 'NOW' }),
    },
  }))

  return {
    firestore: adminMock.firestore,
    messagingSend,
    serverTimestamp: () => 'SERVER_TS',
    arrayUnion: (...x) => ({ __arrayUnion: x }),
  }
}

// ----- Snapshot factory for triggers --------------------------------------

export function makeChange<T extends Record<string, unknown>>(data: T) {
  return {
    data: () => data,
    id: 'attendance-id-1',
    ref: { id: 'attendance-id-1' },
  }
}
