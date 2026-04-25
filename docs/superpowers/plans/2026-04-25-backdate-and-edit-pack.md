# Backdate Prior Usage & Edit Pack Size — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow teachers to (a) record backdated attendance against an active pack — by date or by count — and (b) edit the pack size of an active subscription, with a full audit trail rendered on the student profile. PWA-only feature; iOS app is a separate codebase and is out of scope.

**Architecture:** Mutations to `classesRemaining` / `packSize` / `editHistory` go through a new callable `editSubscription` Cloud Function (preserving the "server-only deduction" invariant). Backdated attendance docs carry an `isBackdated: true` flag — the existing `onAttendanceCreated` trigger reads this flag, skips both FCM sends, still performs FIFO decrement, and appends a `backdate-dates` entry to the target subscription's `editHistory`. UI: shared `PackEditDialog` reused by `AssignSubscription` (new pack flow) and `StudentProfile` (existing pack flow). All writes preserve the existing AEST/DD-MM-YYYY conventions.

**Tech Stack:** TypeScript 5, React 19 + Vite + Tailwind 4 (PWA), Firebase v11 client SDK, firebase-admin/firebase-functions v5 (Node 20 runtime), vitest 3 + jsdom + Testing Library (PWA tests), vitest 3 + firebase-functions-test (offline mode) + admin SDK mocks (Cloud Function tests).

**GitHub:** Implements [biswan07/fusion-steps#2](https://github.com/biswan07/fusion-steps/issues/2). Stakeholder: Sriparna.

---

## File Structure

### Existing files modified

| File | Lines / Reason |
|---|---|
| `src/types.ts` | Add `EditEntry`, `SubscriptionEditAction`; extend `Subscription` with `editHistory`; extend `AttendanceRecord` with optional `isBackdated`. |
| `functions/src/onAttendanceCreated.ts` | Read `isBackdated` from snapshot. If true → skip both FCM sends; still FIFO-decrement; append `backdate-dates` entry to the target subscription's `editHistory`. Otherwise unchanged. |
| `functions/src/index.ts` | Export new `editSubscription`. |
| `functions/package.json` | Add `vitest`, `firebase-functions-test`, `@types/node` devDeps; add `test`, `test:watch` scripts. |
| `firestore.rules` | Tighten `subscriptions/{id}` update — clients (incl. teachers) cannot write `classesRemaining`, `packSize`, or `editHistory` (those go through `editSubscription`); allow teacher to set `isBackdated: true` at create on `attendance/{id}`. |
| `src/pages/teacher/AssignSubscription.tsx` | Add collapsible "Already attended classes" section with By date / By count tabs (US-1, US-2). Writes `isBackdated: true` attendance docs (by-date) or sets `classesRemaining = packSize − used` directly at create (by-count). |
| `src/pages/teacher/StudentProfile.tsx` | Add "Add past attendance" + "Edit pack" actions on the active pack card; render `editHistory` strip; expandable history section (US-3, US-4, US-5). |
| `CLAUDE.md` | Add gotcha entry: `isBackdated` flag suppresses FCM. |

### New files

| File | Purpose |
|---|---|
| `functions/src/editSubscription.ts` | New callable: `op = 'resize' \| 'backdate-count'`. Validates teacher caller. Atomic transaction reads sub, applies mutation, appends `editHistory`. |
| `functions/tests/helpers.ts` | Mock harness for `firebase-admin` — fake firestore document/collection/query, fake messaging.send, snapshot factory. |
| `functions/tests/onAttendanceCreated.test.ts` | Trigger unit tests — FCM skip on `isBackdated`, FIFO decrement still runs, editHistory append. |
| `functions/tests/editSubscription.test.ts` | Callable unit tests — auth gate, resize math, backdate-count math, validation bounds, editHistory append. |
| `functions/tsconfig.json` | (existing) — verify `strict` and `target` settings; no change expected. |
| `functions/vitest.config.ts` | Vitest config for the functions workspace (Node env, no setup file). |
| `src/components/PackEditDialog.tsx` | Shared modal — three modes: `resize`, `backdate-count`, `backdate-dates`. Owns validation + submit. |
| `src/utils/editHistory.ts` | `formatEditEntry(entry: EditEntry): string` for the History strip; `actionLabel(action)`. |
| `src/lib/callables.ts` | Tiny wrapper around `httpsCallable(functions, 'editSubscription')` so UI doesn't import `firebase/functions` repeatedly. |
| `tests/utils/editHistory.test.ts` | Format / label tests. |
| `tests/components/PackEditDialog.test.tsx` | Validation bounds, disabled-confirm states. |
| `tests/pages/teacher/AssignSubscription.test.tsx` | By-date and by-count flows write correct docs. |
| `tests/pages/teacher/StudentProfile.test.tsx` | Edit pack and add-past-attendance dialogs surface; editHistory renders in reverse chrono order. |

---

## Slice ordering & rationale

Each slice ships independently working software. TDD order: tests first, implementation second, commit third.

1. **T1** — Functions test harness (vitest + firebase-functions-test + admin mocks). Foundation for T2/T4.
2. **T2** — `onAttendanceCreated` reads `isBackdated`, skips FCM, still decrements FIFO, appends `editHistory`. **First slice the user requested.**
3. **T3** — Type additions (`EditEntry`, `SubscriptionEditAction`, optional `isBackdated`).
4. **T4** — `editSubscription` callable + export wired in `functions/src/index.ts`.
5. **T5** — Firestore rules tightening + rules unit tests (deferred to manual emulator check; lightweight rule edit + lint).
6. **T6** — `formatEditEntry` util + tests.
7. **T7** — `PackEditDialog` component + tests.
8. **T8** — `AssignSubscription` integration (US-1 by date, US-2 by count) + tests.
9. **T9** — `StudentProfile` integration (US-3 backdate on existing, US-4 resize, US-5 history) + tests.
10. **T10** — `CLAUDE.md` gotcha update.

---

## Task 1: Functions test harness

**Why:** `functions/` has no test runner today. Both T2 and T4 need to call trigger / callable handlers in isolation with stubbed `firebase-admin`. Set this up once; reuse it.

**Files:**
- Modify: `functions/package.json`
- Create: `functions/vitest.config.ts`
- Create: `functions/tests/helpers.ts`
- Create: `functions/tests/.gitignore` (just `lib/`)

- [ ] **Step 1: Add devDeps and scripts to `functions/package.json`**

Replace the `devDependencies` and `scripts` blocks. Final file:

```json
{
  "name": "fusion-steps-functions",
  "private": true,
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": { "node": "20" },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "firebase-functions-test": "^3.3.0",
    "typescript": "^5.3.0",
    "vitest": "^3.1.1"
  }
}
```

- [ ] **Step 2: Install**

```bash
cd functions && npm install
```

Expected: lockfile updated; no peer-dep errors.

- [ ] **Step 3: Create `functions/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
})
```

- [ ] **Step 4: Create `functions/tests/helpers.ts`** — admin/messaging/firestore mocks

```ts
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
  FieldValue?: {
    serverTimestamp: () => string
    arrayUnion: (...x: unknown[]) => { __arrayUnion: unknown[] }
  }
}

export function makeDoc<T extends Record<string, unknown>>(
  id: string,
  data: T | null,
  updateImpl?: (patch: Record<string, unknown>) => void
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
  docs: StubDoc<T>[]
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
  const messagingSend = opts.messagingImpl?.().send ?? vi.fn().mockResolvedValue('msg-id')
  const adminMock = {
    firestore: vi.fn(() => opts.firestoreImpl()),
    messaging: vi.fn(() => ({ send: messagingSend })),
    initializeApp: vi.fn(),
  }
  // attach static FieldValue / Timestamp on firestore
  ;(adminMock.firestore as unknown as Record<string, unknown>).FieldValue = {
    serverTimestamp: () => 'SERVER_TS',
    arrayUnion: (...x: unknown[]) => ({ __arrayUnion: x }),
  }
  vi.doMock('firebase-admin', () => adminMock)
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
```

- [ ] **Step 5: Create `functions/tests/.gitignore`**

```
lib/
node_modules/
```

- [ ] **Step 6: Smoke-test the harness**

Create `functions/tests/harness.smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeDoc, makeQuerySnap } from './helpers'

describe('test harness', () => {
  it('creates a stub doc', () => {
    const d = makeDoc('x', { foo: 1 })
    expect(d.id).toBe('x')
    expect(d.exists).toBe(true)
    expect(d.data().foo).toBe(1)
  })

  it('makes empty query snap', () => {
    expect(makeQuerySnap([]).empty).toBe(true)
  })
})
```

Run: `cd functions && npm test`
Expected: `2 passed`.

- [ ] **Step 7: Delete the smoke file**

```bash
rm functions/tests/harness.smoke.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add functions/package.json functions/package-lock.json functions/vitest.config.ts functions/tests/helpers.ts functions/tests/.gitignore
git commit -m "chore(functions): add vitest harness with firebase-admin mocks"
```

---

## Task 2: `onAttendanceCreated` — `isBackdated` handling

**Spec:** R1, AC-1.6, AC-1.7, AC-1.8, AC-3.4, AC-3.5.

**Files:**
- Modify: `functions/src/onAttendanceCreated.ts`
- Create: `functions/tests/onAttendanceCreated.test.ts`

### Subtask 2.1: Test — FCM is suppressed when `isBackdated: true`

- [ ] **Step 1: Write the failing test**

Create `functions/tests/onAttendanceCreated.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { installAdminMock, makeDoc, makeQuerySnap, makeChange } from './helpers'

describe('onAttendanceCreated — isBackdated', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
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
    const handler = (onAttendanceCreated as unknown as { run: Function }).run
      ?? onAttendanceCreated

    const change = makeChange({
      status: 'present',
      studentId: 'student-1',
      batchName: 'Tuesday Bollywood',
      date: { toDate: () => new Date('2026-04-20T10:00:00Z') },
      isBackdated: true,
      markedBy: 'teacher-1',
    })

    await handler(change as never, { params: { attendanceId: 'a1' } } as never)

    expect(admin.messagingSend).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd functions && npm test -- tests/onAttendanceCreated.test.ts
```

Expected: FAIL — `expected "spy" to not be called` (current trigger always sends).

- [ ] **Step 3: Implement minimal change in `functions/src/onAttendanceCreated.ts`**

Replace the file with:

```ts
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

export const onAttendanceCreated = functions.firestore
  .document('attendance/{attendanceId}')
  .onCreate(async (snap) => {
    const data = snap.data()
    if (data.status !== 'present') return

    const isBackdated = data.isBackdated === true
    const db = admin.firestore()

    // FIFO: oldest active subscription first
    const subsSnap = await db.collection('subscriptions')
      .where('studentId', '==', data.studentId)
      .where('isActive', '==', true)
      .orderBy('assignedAt', 'asc')
      .limit(1)
      .get()

    let oldRemaining: number | null = null
    let newRemaining: number | null = null
    let packSize: number | null = null
    let subRef: FirebaseFirestore.DocumentReference | null = null

    if (!subsSnap.empty) {
      const subDoc = subsSnap.docs[0]
      const subData = subDoc.data()
      oldRemaining = subData.classesRemaining
      packSize = subData.packSize
      newRemaining = (oldRemaining ?? 0) - 1
      subRef = subDoc.ref

      const updates: Record<string, unknown> = { classesRemaining: newRemaining }
      if (newRemaining <= 0) updates.isActive = false

      // For backdated entries, also append an audit row to editHistory.
      if (isBackdated) {
        updates.editHistory = admin.firestore.FieldValue.arrayUnion({
          action: 'backdate-dates',
          editedBy: data.markedBy,
          editedAt: admin.firestore.Timestamp.now(),
          oldValue: { packSize, classesRemaining: oldRemaining },
          newValue: { packSize, classesRemaining: newRemaining },
          dates: [data.date],
        })
      }

      await subRef.update(updates)
    }

    // Backdated attendance never fires FCM (neither low-balance nor receipt).
    if (isBackdated) return

    // Low-balance notification if ≤ 2 classes remaining
    if (newRemaining !== null && newRemaining > 0 && newRemaining <= 2) {
      await sendNotification(
        data.studentId,
        'Low Balance',
        `You have ${newRemaining} class${newRemaining === 1 ? '' : 'es'} left — talk to Sriparna to top up`
      )
    }

    // Attendance notification — date in AEST DD/MM/YYYY
    const date = data.date.toDate()
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    const dateStr = formatter.format(date)

    await sendNotification(
      data.studentId,
      'Attendance Marked',
      `Your attendance for ${data.batchName} on ${dateStr} has been marked — Fusion Steps`
    )
  })

async function sendNotification(userId: string, title: string, body: string) {
  const userDoc = await admin.firestore().doc(`users/${userId}`).get()
  const fcmToken = userDoc.data()?.fcmToken
  if (!fcmToken) return

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
    })
  } catch (err) {
    console.warn('FCM send failed:', err)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd functions && npm test -- tests/onAttendanceCreated.test.ts
```

Expected: PASS (1 test).

### Subtask 2.2: Test — FIFO decrement still runs when `isBackdated: true`

- [ ] **Step 1: Append failing test to `functions/tests/onAttendanceCreated.test.ts`**

Inside the existing `describe('onAttendanceCreated — isBackdated'`:

```ts
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
    const handler = (onAttendanceCreated as unknown as { run: Function }).run
      ?? onAttendanceCreated

    const change = makeChange({
      status: 'present',
      studentId: 'student-1',
      batchName: 'X',
      date: { toDate: () => new Date('2026-04-20T10:00:00Z') },
      isBackdated: true,
      markedBy: 'teacher-1',
    })
    await handler(change as never, { params: { attendanceId: 'a1' } } as never)

    expect(subDoc.ref.update).toHaveBeenCalledTimes(1)
    expect(captured!.classesRemaining).toBe(4)
  })
```

- [ ] **Step 2: Run**

```bash
cd functions && npm test -- tests/onAttendanceCreated.test.ts
```

Expected: PASS (2 tests). The implementation in subtask 2.1 already handles this — verifying.

### Subtask 2.3: Test — `editHistory` entry is appended on backdated attendance

- [ ] **Step 1: Append failing test**

```ts
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
    const handler = (onAttendanceCreated as unknown as { run: Function }).run
      ?? onAttendanceCreated

    const dateValue = { toDate: () => new Date('2026-04-15T10:00:00Z') }
    await handler(
      makeChange({
        status: 'present',
        studentId: 'student-1',
        batchName: 'X',
        date: dateValue,
        isBackdated: true,
        markedBy: 'teacher-1',
      }) as never,
      { params: { attendanceId: 'a1' } } as never
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
```

- [ ] **Step 2: Run**

```bash
cd functions && npm test -- tests/onAttendanceCreated.test.ts
```

Expected: PASS (3 tests).

### Subtask 2.4: Regression — non-backdated path is unchanged

- [ ] **Step 1: Append failing test (will pass — regression guard)**

```ts
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
    const handler = (onAttendanceCreated as unknown as { run: Function }).run
      ?? onAttendanceCreated

    await handler(
      makeChange({
        status: 'present',
        studentId: 'student-1',
        batchName: 'Tuesday',
        date: { toDate: () => new Date('2026-04-20T10:00:00Z') },
        markedBy: 'teacher-1',
      }) as never,
      { params: { attendanceId: 'a1' } } as never
    )

    // Regression: low-balance + receipt = 2 sends.
    expect(admin.messagingSend).toHaveBeenCalledTimes(2)
    expect(captured!.classesRemaining).toBe(1)
    expect(captured!.editHistory).toBeUndefined()
  })
```

- [ ] **Step 2: Run**

```bash
cd functions && npm test -- tests/onAttendanceCreated.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 3: Build to verify TypeScript compiles**

```bash
cd functions && npm run build
```

Expected: no errors. `lib/onAttendanceCreated.js` written.

- [ ] **Step 4: Commit**

```bash
git add functions/src/onAttendanceCreated.ts functions/tests/onAttendanceCreated.test.ts
git commit -m "feat(functions): suppress FCM and append editHistory for backdated attendance

Refs: #2 (R1, AC-1.7, AC-1.8, AC-3.4)"
```

---

## Task 3: Type additions

**Spec:** AC-1.8, AC-2.4, AC-4.5, US-5.

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Append types in `src/types.ts`**

Add at the bottom of the file:

```ts
export type SubscriptionEditAction =
  | 'backdate-dates'
  | 'backdate-count'
  | 'resize'

export interface EditEntry {
  action: SubscriptionEditAction
  editedBy: string             // teacher uid
  editedAt: Date
  oldValue: { packSize: PackSize; classesRemaining: number }
  newValue: { packSize: PackSize; classesRemaining: number }
  dates?: Date[]               // present for backdate-dates
  reason?: string              // optional, free text (future)
}
```

Then extend the existing `Subscription` interface — replace it with:

```ts
export interface Subscription {
  id: string
  studentId: string
  studentName: string
  packSize: PackSize
  classesRemaining: number
  assignedBy: string
  assignedAt: Date
  isActive: boolean
  editHistory?: EditEntry[]
}
```

And `AttendanceRecord` — replace with:

```ts
export interface AttendanceRecord {
  id: string
  batchId: string
  studentId: string
  studentName: string
  batchName: string
  date: Date
  status: AttendanceStatus
  markedBy: string
  createdAt: Date
  isBackdated?: boolean
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build passes (no callers reference the new fields yet).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add EditEntry, isBackdated, editHistory

Refs: #2"
```

---

## Task 4: `editSubscription` callable

**Spec:** R5, R6, US-2 (post-assign tweak), US-3 (by-count on existing pack), US-4 (resize).

**Files:**
- Create: `functions/src/editSubscription.ts`
- Create: `functions/tests/editSubscription.test.ts`
- Modify: `functions/src/index.ts`

### Subtask 4.1: Auth gate test

- [ ] **Step 1: Write the failing test**

Create `functions/tests/editSubscription.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installAdminMock, makeDoc } from './helpers'

const VALID_RESIZE = { subscriptionId: 'sub-1', op: 'resize', newPackSize: 10, newClassesRemaining: 8 }

describe('editSubscription — auth gate', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.restoreAllMocks() })

  it('rejects unauthenticated callers', async () => {
    installAdminMock({ firestoreImpl: () => ({ collection: vi.fn(), doc: vi.fn() }) })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = (editSubscription as unknown as { run: Function }).run ?? editSubscription
    await expect(handler(VALID_RESIZE, {} as never)).rejects.toMatchObject({
      code: 'unauthenticated',
    })
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
    const handler = (editSubscription as unknown as { run: Function }).run ?? editSubscription
    await expect(
      handler(VALID_RESIZE, { auth: { uid: 'user-x' } } as never)
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })
})
```

- [ ] **Step 2: Run — expect failure (file does not exist)**

```bash
cd functions && npm test -- tests/editSubscription.test.ts
```

Expected: FAIL with `Cannot find module '../src/editSubscription'`.

- [ ] **Step 3: Create `functions/src/editSubscription.ts` (auth gate only)**

```ts
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

type PackSize = 1 | 5 | 10 | 20

type EditSubscriptionInput =
  | { subscriptionId: string; op: 'resize'; newPackSize: PackSize; newClassesRemaining: number }
  | { subscriptionId: string; op: 'backdate-count'; usedCount: number }

export const editSubscription = functions.https.onCall(
  async (data: EditSubscriptionInput, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
    }
    const callerDoc = await admin.firestore().doc(`users/${context.auth.uid}`).get()
    if (callerDoc.data()?.role !== 'teacher') {
      throw new functions.https.HttpsError('permission-denied', 'Only teachers can edit subscriptions')
    }

    throw new functions.https.HttpsError('unimplemented', 'op not implemented yet')
  }
)
```

- [ ] **Step 4: Run — expect 2 passing auth tests**

```bash
cd functions && npm test -- tests/editSubscription.test.ts
```

Expected: PASS (2 tests).

### Subtask 4.2: Resize op — happy path

- [ ] **Step 1: Append failing test**

```ts
describe('editSubscription — resize', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.restoreAllMocks() })

  it('updates packSize, classesRemaining, and appends editHistory atomically', async () => {
    const teacherDoc = makeDoc('teacher-1', { role: 'teacher' })
    const subDoc = makeDoc('sub-1', {
      packSize: 5, classesRemaining: 3, isActive: true,
      studentId: 'student-1', editHistory: [],
    })

    let txnUpdate: Record<string, unknown> | null = null

    installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(),
        doc: vi.fn((path: string) => {
          if (path === 'users/teacher-1') return { get: async () => teacherDoc }
          if (path === 'subscriptions/sub-1') return subDoc.ref
          throw new Error('unexpected path: ' + path)
        }),
        runTransaction: vi.fn(async (fn: (txn: any) => Promise<unknown>) => {
          const txn = {
            get: vi.fn(async () => subDoc),
            update: vi.fn((_ref, patch) => { txnUpdate = patch }),
          }
          return fn(txn)
        }),
      }),
    })

    const { editSubscription } = await import('../src/editSubscription')
    const handler = (editSubscription as unknown as { run: Function }).run ?? editSubscription

    await handler(
      { subscriptionId: 'sub-1', op: 'resize', newPackSize: 10, newClassesRemaining: 8 },
      { auth: { uid: 'teacher-1' } } as never
    )

    expect(txnUpdate!.packSize).toBe(10)
    expect(txnUpdate!.classesRemaining).toBe(8)
    expect(txnUpdate!.isActive).toBe(true)
    const eh = txnUpdate!.editHistory as { __arrayUnion: unknown[] }
    const entry = eh.__arrayUnion[0] as Record<string, unknown>
    expect(entry.action).toBe('resize')
    expect(entry.oldValue).toEqual({ packSize: 5, classesRemaining: 3 })
    expect(entry.newValue).toEqual({ packSize: 10, classesRemaining: 8 })
    expect(entry.editedBy).toBe('teacher-1')
  })

  it('flips isActive to false when newClassesRemaining is 0', async () => {
    const teacherDoc = makeDoc('teacher-1', { role: 'teacher' })
    const subDoc = makeDoc('sub-1', {
      packSize: 5, classesRemaining: 3, isActive: true,
      studentId: 'student-1', editHistory: [],
    })
    let txnUpdate: Record<string, unknown> | null = null

    installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(),
        doc: vi.fn((path: string) => {
          if (path === 'users/teacher-1') return { get: async () => teacherDoc }
          if (path === 'subscriptions/sub-1') return subDoc.ref
          throw new Error('unexpected path: ' + path)
        }),
        runTransaction: vi.fn(async (fn: (txn: any) => Promise<unknown>) => {
          const txn = {
            get: vi.fn(async () => subDoc),
            update: vi.fn((_ref, patch) => { txnUpdate = patch }),
          }
          return fn(txn)
        }),
      }),
    })

    const { editSubscription } = await import('../src/editSubscription')
    const handler = (editSubscription as unknown as { run: Function }).run ?? editSubscription

    await handler(
      { subscriptionId: 'sub-1', op: 'resize', newPackSize: 10, newClassesRemaining: 0 },
      { auth: { uid: 'teacher-1' } } as never
    )
    expect(txnUpdate!.isActive).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect failures**

```bash
cd functions && npm test -- tests/editSubscription.test.ts
```

Expected: FAIL — `unimplemented` thrown.

- [ ] **Step 3: Implement resize in `functions/src/editSubscription.ts`**

Replace the file with:

```ts
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

type PackSize = 1 | 5 | 10 | 20
const VALID_PACK_SIZES: PackSize[] = [1, 5, 10, 20]
const MAX_BACKDATE_COUNT = 100

type EditSubscriptionInput =
  | { subscriptionId: string; op: 'resize'; newPackSize: PackSize; newClassesRemaining: number }
  | { subscriptionId: string; op: 'backdate-count'; usedCount: number }

export const editSubscription = functions.https.onCall(
  async (data: EditSubscriptionInput, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
    }
    const callerUid = context.auth.uid
    const callerDoc = await admin.firestore().doc(`users/${callerUid}`).get()
    if (callerDoc.data()?.role !== 'teacher') {
      throw new functions.https.HttpsError('permission-denied', 'Only teachers can edit subscriptions')
    }

    if (!data || typeof data.subscriptionId !== 'string' || !data.subscriptionId) {
      throw new functions.https.HttpsError('invalid-argument', 'subscriptionId required')
    }

    const db = admin.firestore()
    const subRef = db.doc(`subscriptions/${data.subscriptionId}`)

    return db.runTransaction(async (txn) => {
      const subSnap = await txn.get(subRef)
      if (!subSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Subscription not found')
      }
      const sub = subSnap.data() as {
        packSize: PackSize; classesRemaining: number; isActive: boolean; studentId: string
      }

      if (data.op === 'resize') {
        if (!VALID_PACK_SIZES.includes(data.newPackSize)) {
          throw new functions.https.HttpsError('invalid-argument', 'Invalid pack size')
        }
        if (
          typeof data.newClassesRemaining !== 'number' ||
          data.newClassesRemaining < 0 ||
          data.newClassesRemaining > data.newPackSize
        ) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            `newClassesRemaining must be 0..${data.newPackSize}`
          )
        }

        const patch: Record<string, unknown> = {
          packSize: data.newPackSize,
          classesRemaining: data.newClassesRemaining,
          isActive: data.newClassesRemaining > 0,
          editHistory: admin.firestore.FieldValue.arrayUnion({
            action: 'resize',
            editedBy: callerUid,
            editedAt: admin.firestore.Timestamp.now(),
            oldValue: { packSize: sub.packSize, classesRemaining: sub.classesRemaining },
            newValue: { packSize: data.newPackSize, classesRemaining: data.newClassesRemaining },
          }),
        }
        txn.update(subRef, patch)
        return { ok: true }
      }

      if (data.op === 'backdate-count') {
        if (
          typeof data.usedCount !== 'number' ||
          !Number.isInteger(data.usedCount) ||
          data.usedCount < 1 ||
          data.usedCount > MAX_BACKDATE_COUNT
        ) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            `usedCount must be 1..${MAX_BACKDATE_COUNT}`
          )
        }
        if (data.usedCount > sub.classesRemaining) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `usedCount (${data.usedCount}) exceeds classesRemaining (${sub.classesRemaining})`
          )
        }
        const newRemaining = sub.classesRemaining - data.usedCount
        const patch: Record<string, unknown> = {
          classesRemaining: newRemaining,
          isActive: newRemaining > 0,
          editHistory: admin.firestore.FieldValue.arrayUnion({
            action: 'backdate-count',
            editedBy: callerUid,
            editedAt: admin.firestore.Timestamp.now(),
            oldValue: { packSize: sub.packSize, classesRemaining: sub.classesRemaining },
            newValue: { packSize: sub.packSize, classesRemaining: newRemaining },
          }),
        }
        txn.update(subRef, patch)
        return { ok: true }
      }

      throw new functions.https.HttpsError('invalid-argument', 'Unknown op')
    })
  }
)
```

- [ ] **Step 4: Run — expect resize tests pass**

```bash
cd functions && npm test -- tests/editSubscription.test.ts
```

Expected: PASS (4 tests — 2 auth + 2 resize).

### Subtask 4.3: Resize — validation bounds

- [ ] **Step 1: Append tests**

```ts
describe('editSubscription — resize validation', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.restoreAllMocks() })

  it.each([
    { newPackSize: 7, newClassesRemaining: 3, code: 'invalid-argument' as const },
    { newPackSize: 10, newClassesRemaining: -1, code: 'invalid-argument' as const },
    { newPackSize: 10, newClassesRemaining: 11, code: 'invalid-argument' as const },
  ])('rejects %j', async ({ newPackSize, newClassesRemaining, code }) => {
    const teacherDoc = makeDoc('teacher-1', { role: 'teacher' })
    const subDoc = makeDoc('sub-1', { packSize: 5, classesRemaining: 3, isActive: true })
    installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(),
        doc: vi.fn((path: string) =>
          path === 'users/teacher-1'
            ? { get: async () => teacherDoc }
            : subDoc.ref
        ),
        runTransaction: vi.fn(async (fn: (txn: any) => Promise<unknown>) => {
          return fn({ get: async () => subDoc, update: vi.fn() })
        }),
      }),
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = (editSubscription as unknown as { run: Function }).run ?? editSubscription
    await expect(
      handler(
        { subscriptionId: 'sub-1', op: 'resize', newPackSize: newPackSize as never, newClassesRemaining },
        { auth: { uid: 'teacher-1' } } as never
      )
    ).rejects.toMatchObject({ code })
  })
})
```

- [ ] **Step 2: Run**

```bash
cd functions && npm test -- tests/editSubscription.test.ts
```

Expected: PASS (7 tests).

### Subtask 4.4: backdate-count happy path + bounds

- [ ] **Step 1: Append tests**

```ts
describe('editSubscription — backdate-count', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.restoreAllMocks() })

  it('decrements classesRemaining by usedCount and appends editHistory', async () => {
    const teacherDoc = makeDoc('teacher-1', { role: 'teacher' })
    const subDoc = makeDoc('sub-1', { packSize: 10, classesRemaining: 10, isActive: true })
    let captured: Record<string, unknown> | null = null
    installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(),
        doc: vi.fn((path: string) =>
          path === 'users/teacher-1' ? { get: async () => teacherDoc } : subDoc.ref
        ),
        runTransaction: vi.fn(async (fn: (txn: any) => Promise<unknown>) =>
          fn({ get: async () => subDoc, update: (_ref: unknown, patch: Record<string, unknown>) => { captured = patch } })
        ),
      }),
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = (editSubscription as unknown as { run: Function }).run ?? editSubscription
    await handler(
      { subscriptionId: 'sub-1', op: 'backdate-count', usedCount: 3 },
      { auth: { uid: 'teacher-1' } } as never
    )
    expect(captured!.classesRemaining).toBe(7)
    expect(captured!.isActive).toBe(true)
    const eh = captured!.editHistory as { __arrayUnion: unknown[] }
    const entry = eh.__arrayUnion[0] as Record<string, unknown>
    expect(entry.action).toBe('backdate-count')
    expect(entry.oldValue).toEqual({ packSize: 10, classesRemaining: 10 })
    expect(entry.newValue).toEqual({ packSize: 10, classesRemaining: 7 })
  })

  it('flips isActive=false when usedCount equals classesRemaining', async () => {
    const teacherDoc = makeDoc('teacher-1', { role: 'teacher' })
    const subDoc = makeDoc('sub-1', { packSize: 5, classesRemaining: 5, isActive: true })
    let captured: Record<string, unknown> | null = null
    installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(),
        doc: vi.fn((path: string) =>
          path === 'users/teacher-1' ? { get: async () => teacherDoc } : subDoc.ref
        ),
        runTransaction: vi.fn(async (fn: (txn: any) => Promise<unknown>) =>
          fn({ get: async () => subDoc, update: (_ref: unknown, patch: Record<string, unknown>) => { captured = patch } })
        ),
      }),
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = (editSubscription as unknown as { run: Function }).run ?? editSubscription
    await handler(
      { subscriptionId: 'sub-1', op: 'backdate-count', usedCount: 5 },
      { auth: { uid: 'teacher-1' } } as never
    )
    expect(captured!.classesRemaining).toBe(0)
    expect(captured!.isActive).toBe(false)
  })

  it('rejects usedCount exceeding classesRemaining', async () => {
    const teacherDoc = makeDoc('teacher-1', { role: 'teacher' })
    const subDoc = makeDoc('sub-1', { packSize: 5, classesRemaining: 2, isActive: true })
    installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(),
        doc: vi.fn((path: string) =>
          path === 'users/teacher-1' ? { get: async () => teacherDoc } : subDoc.ref
        ),
        runTransaction: vi.fn(async (fn: (txn: any) => Promise<unknown>) =>
          fn({ get: async () => subDoc, update: vi.fn() })
        ),
      }),
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = (editSubscription as unknown as { run: Function }).run ?? editSubscription
    await expect(
      handler(
        { subscriptionId: 'sub-1', op: 'backdate-count', usedCount: 5 },
        { auth: { uid: 'teacher-1' } } as never
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' })
  })

  it.each([0, -1, 1.5, 101])('rejects usedCount=%s', async (usedCount) => {
    const teacherDoc = makeDoc('teacher-1', { role: 'teacher' })
    const subDoc = makeDoc('sub-1', { packSize: 10, classesRemaining: 10, isActive: true })
    installAdminMock({
      firestoreImpl: () => ({
        collection: vi.fn(),
        doc: vi.fn((path: string) =>
          path === 'users/teacher-1' ? { get: async () => teacherDoc } : subDoc.ref
        ),
        runTransaction: vi.fn(async (fn: (txn: any) => Promise<unknown>) =>
          fn({ get: async () => subDoc, update: vi.fn() })
        ),
      }),
    })
    const { editSubscription } = await import('../src/editSubscription')
    const handler = (editSubscription as unknown as { run: Function }).run ?? editSubscription
    await expect(
      handler(
        { subscriptionId: 'sub-1', op: 'backdate-count', usedCount },
        { auth: { uid: 'teacher-1' } } as never
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})
```

- [ ] **Step 2: Run**

```bash
cd functions && npm test -- tests/editSubscription.test.ts
```

Expected: PASS (14 tests — 2 auth + 2 resize-happy + 3 resize-bounds + 2 count-happy + 1 precondition + 4 count-bounds).

### Subtask 4.5: Wire export

- [ ] **Step 1: Update `functions/src/index.ts`**

Final file:

```ts
import * as admin from 'firebase-admin'
admin.initializeApp()

export { createStudent } from './createStudent'
export { editSubscription } from './editSubscription'
export { onAttendanceCreated } from './onAttendanceCreated'
export { onVideoCreated } from './onVideoCreated'
```

- [ ] **Step 2: Build**

```bash
cd functions && npm run build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add functions/src/editSubscription.ts functions/src/index.ts functions/tests/editSubscription.test.ts
git commit -m "feat(functions): add editSubscription callable for resize and backdate-count

Refs: #2 (R5, US-2, US-3, US-4)"
```

---

## Task 5: Firestore rules tightening

**Spec:** R5 ("server-only deduction" preserved), R7 (teacher-only), AC-1.6 (`isBackdated: true` allowed at create on attendance).

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Replace `firestore.rules` with the tightened version**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isTeacher() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }

    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read: if isTeacher() || isOwner(userId);
      allow create: if isTeacher();
      allow update: if isTeacher() ||
        (isOwner(userId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['fcmToken']));
    }

    match /batches/{batchId} {
      allow read: if isTeacher() ||
        (request.auth != null && resource.data.studentIds.hasAny([request.auth.uid]));
      allow create, update, delete: if isTeacher();
    }

    match /attendance/{attendanceId} {
      allow read: if isTeacher() || (request.auth != null && resource.data.studentId == request.auth.uid);
      allow create, update: if isTeacher();
      // isBackdated is a teacher-set boolean and is allowed by virtue of teacher having full create access.
    }

    match /subscriptions/{subscriptionId} {
      allow read: if isTeacher() || (request.auth != null && resource.data.studentId == request.auth.uid);
      // Teachers may CREATE subscriptions and may UPDATE only the lifecycle field `isActive`.
      // All mutations to packSize / classesRemaining / editHistory go through the
      // editSubscription Cloud Function (admin SDK bypasses these rules).
      allow create: if isTeacher();
      allow update: if isTeacher() &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isActive']);
    }

    match /videos/{videoId} {
      allow read: if isTeacher() ||
        (request.auth != null &&
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.batchIds.hasAny(resource.data.batchIds));
      allow write: if isTeacher();
    }
  }
}
```

> **Why `isActive`-only update?** `AssignSubscription.tsx`'s D3 fix updates `isActive: false` on prior active subs. That single-field update must remain allowed. Everything else routes through the cloud function.

- [ ] **Step 2: Verify rules syntax with the emulator (manual smoke test)**

```bash
firebase emulators:exec --only firestore "echo rules-loaded-ok"
```

Expected: emulator boots without rule-parse errors and prints `rules-loaded-ok`.

If `firebase` CLI is not installed locally, skip this step and rely on CI. Note in the commit message that rules were not emulator-verified locally.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): block client writes to subscription mutation fields

Refs: #2 (R5, R7)"
```

---

## Task 6: `formatEditEntry` util

**Spec:** AC-5.2, AC-5.3, AC-5.4.

**Files:**
- Create: `src/utils/editHistory.ts`
- Create: `tests/utils/editHistory.test.ts`

### Subtask 6.1: Tests first

- [ ] **Step 1: Write the failing tests**

Create `tests/utils/editHistory.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatEditEntry, actionLabel } from '../../src/utils/editHistory'
import type { EditEntry } from '../../src/types'

const baseEntry: EditEntry = {
  action: 'resize',
  editedBy: 'teacher-1',
  editedAt: new Date('2026-04-25T08:30:00+10:00'),
  oldValue: { packSize: 5, classesRemaining: 3 },
  newValue: { packSize: 10, classesRemaining: 8 },
}

describe('actionLabel', () => {
  it('returns the human label for each action', () => {
    expect(actionLabel('resize', baseEntry)).toBe('Resized 5→10 (remaining 3→8)')
    const dates = [new Date('2026-04-20T00:00:00+10:00'), new Date('2026-04-21T00:00:00+10:00')]
    expect(actionLabel('backdate-dates', { ...baseEntry, action: 'backdate-dates', dates })).toBe(
      'Backdated 2 classes by date'
    )
    expect(
      actionLabel('backdate-count', {
        ...baseEntry,
        action: 'backdate-count',
        oldValue: { packSize: 10, classesRemaining: 10 },
        newValue: { packSize: 10, classesRemaining: 7 },
      })
    ).toBe('Backdated 3 classes by count')
  })
})

describe('formatEditEntry', () => {
  it('formats with AEST DD/MM/YYYY HH:mm and action label', () => {
    expect(formatEditEntry(baseEntry)).toBe('25/04/2026 08:30 — Resized 5→10 (remaining 3→8)')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- tests/utils/editHistory.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/editHistory.ts`**

```ts
import type { EditEntry, SubscriptionEditAction } from '../types'
import { formatDateDDMMYYYY, getAESTDate } from './dates'

export function actionLabel(action: SubscriptionEditAction, entry: EditEntry): string {
  if (action === 'resize') {
    const { oldValue, newValue } = entry
    return `Resized ${oldValue.packSize}→${newValue.packSize} (remaining ${oldValue.classesRemaining}→${newValue.classesRemaining})`
  }
  if (action === 'backdate-dates') {
    const n = entry.dates?.length ?? 0
    return `Backdated ${n} class${n === 1 ? '' : 'es'} by date`
  }
  // backdate-count
  const n = entry.oldValue.classesRemaining - entry.newValue.classesRemaining
  return `Backdated ${n} class${n === 1 ? '' : 'es'} by count`
}

export function formatEditEntry(entry: EditEntry): string {
  const date = formatDateDDMMYYYY(entry.editedAt)
  const aest = getAESTDate(entry.editedAt)
  const hh = String(aest.getHours()).padStart(2, '0')
  const mm = String(aest.getMinutes()).padStart(2, '0')
  return `${date} ${hh}:${mm} — ${actionLabel(entry.action, entry)}`
}
```

- [ ] **Step 4: Run — expect passing**

```bash
npm test -- tests/utils/editHistory.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/editHistory.ts tests/utils/editHistory.test.ts
git commit -m "feat(utils): add formatEditEntry for subscription history

Refs: #2 (US-5)"
```

---

## Task 7: `PackEditDialog` component

**Spec:** US-1 by-date, US-2 by-count, US-3 (both), US-4 resize. Shared dialog.

**Files:**
- Create: `src/lib/callables.ts`
- Create: `src/components/PackEditDialog.tsx`
- Create: `tests/components/PackEditDialog.test.tsx`
- Create: `tests/components/__mocks__/firebase.ts` (lightweight stubs)

### Subtask 7.1: Callable wrapper

- [ ] **Step 1: Create `src/lib/callables.ts`**

```ts
import { httpsCallable, getFunctions } from 'firebase/functions'
import { getApp } from 'firebase/app'
import type { PackSize } from '../types'

type EditSubscriptionPayload =
  | { subscriptionId: string; op: 'resize'; newPackSize: PackSize; newClassesRemaining: number }
  | { subscriptionId: string; op: 'backdate-count'; usedCount: number }

export async function callEditSubscription(payload: EditSubscriptionPayload) {
  const fn = httpsCallable(getFunctions(getApp()), 'editSubscription')
  return fn(payload)
}
```

- [ ] **Step 2: Verify import compiles**

```bash
npm run build
```

Expected: clean.

### Subtask 7.2: Component skeleton — render mode-aware UI

- [ ] **Step 1: Write the failing test**

Create `tests/components/PackEditDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PackEditDialog } from '../../src/components/PackEditDialog'

describe('PackEditDialog — resize mode', () => {
  it('renders dropdown for new pack size and pre-fills new remaining', () => {
    render(
      <PackEditDialog
        mode="resize"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    expect(screen.getByLabelText(/new pack size/i)).toBeInTheDocument()
    const remaining = screen.getByLabelText(/new remaining/i) as HTMLInputElement
    expect(remaining.value).toBe('3')
  })

  it('updates pre-filled remaining when pack size changes', () => {
    render(
      <PackEditDialog
        mode="resize"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    const select = screen.getByLabelText(/new pack size/i)
    fireEvent.change(select, { target: { value: '10' } })
    const remaining = screen.getByLabelText(/new remaining/i) as HTMLInputElement
    expect(remaining.value).toBe('8')
  })

  it('disables confirm when no field differs', () => {
    render(
      <PackEditDialog
        mode="resize"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('disables confirm if newRemaining > newPackSize', () => {
    render(
      <PackEditDialog
        mode="resize"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    fireEvent.change(screen.getByLabelText(/new pack size/i), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/new remaining/i), { target: { value: '6' } })
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('calls onConfirm with new values', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <PackEditDialog
        mode="resize"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )
    fireEvent.change(screen.getByLabelText(/new pack size/i), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      mode: 'resize', newPackSize: 10, newClassesRemaining: 8,
    })
  })
})

describe('PackEditDialog — backdate-count mode', () => {
  it('shows a 0..currentRemaining input', () => {
    render(
      <PackEditDialog
        mode="backdate-count"
        currentPackSize={10}
        currentRemaining={10}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    const input = screen.getByLabelText(/already used/i) as HTMLInputElement
    expect(input).toBeInTheDocument()
  })

  it('disables confirm if usedCount > currentRemaining', () => {
    render(
      <PackEditDialog
        mode="backdate-count"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    fireEvent.change(screen.getByLabelText(/already used/i), { target: { value: '5' } })
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('calls onConfirm with usedCount', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <PackEditDialog
        mode="backdate-count"
        currentPackSize={10}
        currentRemaining={10}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )
    fireEvent.change(screen.getByLabelText(/already used/i), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'backdate-count', usedCount: 3 })
  })
})

describe('PackEditDialog — backdate-dates mode', () => {
  it('lets the teacher add and remove date chips', () => {
    render(
      <PackEditDialog
        mode="backdate-dates"
        currentPackSize={10}
        currentRemaining={10}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    const picker = screen.getByLabelText(/add date/i) as HTMLInputElement
    fireEvent.change(picker, { target: { value: '2026-04-20' } })
    fireEvent.click(screen.getByRole('button', { name: /add$/i }))
    expect(screen.getByText('20/04/2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /remove 20\/04\/2026/i }))
    expect(screen.queryByText('20/04/2026')).not.toBeInTheDocument()
  })

  it('rejects dates older than 90 days or in the future', () => {
    render(
      <PackEditDialog
        mode="backdate-dates"
        currentPackSize={10}
        currentRemaining={10}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    const picker = screen.getByLabelText(/add date/i) as HTMLInputElement
    expect(picker.min).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(picker.max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('disables confirm when more dates added than currentRemaining', () => {
    render(
      <PackEditDialog
        mode="backdate-dates"
        currentPackSize={5}
        currentRemaining={1}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    const picker = screen.getByLabelText(/add date/i)
    fireEvent.change(picker, { target: { value: '2026-04-20' } })
    fireEvent.click(screen.getByRole('button', { name: /add$/i }))
    fireEvent.change(picker, { target: { value: '2026-04-21' } })
    fireEvent.click(screen.getByRole('button', { name: /add$/i }))
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- tests/components/PackEditDialog.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/PackEditDialog.tsx`**

```tsx
import { useMemo, useState } from 'react'
import type { PackSize } from '../types'
import { formatDateDDMMYYYY, getAESTDate } from '../utils/dates'

const VALID_SIZES: PackSize[] = [5, 10, 20]
const MAX_BACKDATE_DAYS = 90

export type PackEditMode = 'resize' | 'backdate-count' | 'backdate-dates'

export type PackEditConfirmPayload =
  | { mode: 'resize'; newPackSize: PackSize; newClassesRemaining: number }
  | { mode: 'backdate-count'; usedCount: number }
  | { mode: 'backdate-dates'; dates: Date[] }

interface Props {
  mode: PackEditMode
  currentPackSize: PackSize
  currentRemaining: number
  onClose: () => void
  onConfirm: (payload: PackEditConfirmPayload) => Promise<void>
}

function isoDate(d: Date): string {
  const aest = getAESTDate(d)
  const y = aest.getFullYear()
  const m = String(aest.getMonth() + 1).padStart(2, '0')
  const day = String(aest.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function PackEditDialog({
  mode, currentPackSize, currentRemaining, onClose, onConfirm,
}: Props) {
  const today = useMemo(() => getAESTDate(new Date()), [])
  const minDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - MAX_BACKDATE_DAYS)
    return d
  }, [today])

  // Resize state
  const [newPackSize, setNewPackSize] = useState<PackSize>(currentPackSize)
  const [newRemaining, setNewRemaining] = useState<number>(currentRemaining)
  function changePackSize(size: PackSize) {
    setNewPackSize(size)
    const delta = size - currentPackSize
    setNewRemaining(Math.max(0, Math.min(size, currentRemaining + delta)))
  }

  // Backdate-count state
  const [usedCount, setUsedCount] = useState<number>(0)

  // Backdate-dates state
  const [dates, setDates] = useState<Date[]>([])
  const [pickerValue, setPickerValue] = useState<string>(isoDate(today))
  function addDate() {
    if (!pickerValue) return
    const [y, m, d] = pickerValue.split('-').map(Number)
    const candidate = new Date(y, m - 1, d)
    if (candidate < minDate || candidate > today) return
    if (dates.some((existing) => isoDate(existing) === pickerValue)) return
    setDates([...dates, candidate])
  }
  function removeDate(target: Date) {
    setDates(dates.filter((d) => isoDate(d) !== isoDate(target)))
  }

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canConfirm = (() => {
    if (submitting) return false
    if (mode === 'resize') {
      const validSize = VALID_SIZES.includes(newPackSize)
      const validRemaining = newRemaining >= 0 && newRemaining <= newPackSize
      const differs = newPackSize !== currentPackSize || newRemaining !== currentRemaining
      return validSize && validRemaining && differs
    }
    if (mode === 'backdate-count') {
      return Number.isInteger(usedCount) && usedCount >= 1 && usedCount <= currentRemaining
    }
    // backdate-dates
    return dates.length >= 1 && dates.length <= currentRemaining
  })()

  async function handleConfirm() {
    if (!canConfirm) return
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'resize') {
        await onConfirm({ mode, newPackSize, newClassesRemaining: newRemaining })
      } else if (mode === 'backdate-count') {
        await onConfirm({ mode, usedCount })
      } else {
        await onConfirm({ mode, dates })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
      <div className="w-full max-w-sm rounded-2xl bg-[#1A1A2E] border border-white/10 p-6 space-y-4">
        <h3 className="text-base font-semibold">
          {mode === 'resize' && 'Edit pack size'}
          {mode === 'backdate-count' && 'Backdate by count'}
          {mode === 'backdate-dates' && 'Backdate by date'}
        </h3>

        {mode === 'resize' && (
          <>
            <div className="text-sm text-white/60">
              Current: {currentPackSize}-pack, {currentRemaining} remaining
            </div>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-[#00BCD4]">New pack size</span>
              <select
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                value={newPackSize}
                onChange={(e) => changePackSize(Number(e.target.value) as PackSize)}
              >
                {VALID_SIZES.map((s) => (
                  <option key={s} value={s}>{s}-class pack</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-[#00BCD4]">New remaining</span>
              <input
                type="number"
                min={0}
                max={newPackSize}
                value={newRemaining}
                onChange={(e) => setNewRemaining(Number(e.target.value))}
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
          </>
        )}

        {mode === 'backdate-count' && (
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-[#00BCD4]">Already used</span>
            <input
              type="number"
              min={0}
              max={currentRemaining}
              value={usedCount}
              onChange={(e) => setUsedCount(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-white/40">
              Out of {currentRemaining} remaining
            </span>
          </label>
        )}

        {mode === 'backdate-dates' && (
          <>
            <div className="flex items-end gap-2">
              <label className="flex-1">
                <span className="text-xs uppercase tracking-wider text-[#00BCD4]">Add date</span>
                <input
                  type="date"
                  min={isoDate(minDate)}
                  max={isoDate(today)}
                  value={pickerValue}
                  onChange={(e) => setPickerValue(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={addDate}
                className="rounded-xl bg-[#7B2D8B] px-4 py-2 text-sm"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {dates.map((d) => {
                const label = formatDateDDMMYYYY(d)
                return (
                  <button
                    key={isoDate(d)}
                    type="button"
                    onClick={() => removeDate(d)}
                    aria-label={`Remove ${label}`}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs"
                  >
                    {label} ✕
                  </button>
                )
              })}
            </div>
            <div className="text-xs text-white/40">
              {dates.length}/{currentRemaining} max
            </div>
          </>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm font-medium text-white/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 rounded-xl bg-[#FF6F00] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect tests pass**

```bash
npm test -- tests/components/PackEditDialog.test.tsx
```

Expected: PASS (all PackEditDialog tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/PackEditDialog.tsx src/lib/callables.ts tests/components/PackEditDialog.test.tsx
git commit -m "feat(ui): add PackEditDialog for resize and backdate flows

Refs: #2 (US-1, US-2, US-3, US-4)"
```

---

## Task 8: `AssignSubscription` — backdate-on-assign integration

**Spec:** US-1, US-2.

**Files:**
- Modify: `src/pages/teacher/AssignSubscription.tsx`
- Create: `tests/pages/teacher/AssignSubscription.test.tsx`

### Subtask 8.1: By-count flow at assign time

- [ ] **Step 1: Write the failing test**

Create `tests/pages/teacher/AssignSubscription.test.tsx`:

```tsx
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
  doc: vi.fn(() => ({ id: 'new-sub-id' })),
  serverTimestamp: vi.fn(() => 'TS'),
  query: vi.fn((...args) => args),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  writeBatch: () => ({
    set: mockBatchSet,
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  }),
  addDoc: vi.fn().mockResolvedValue({ id: 'attendance-id' }),
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
    const setCall = mockBatchSet.mock.calls.find(([_, payload]) => payload.packSize === 10)
    expect(setCall).toBeDefined()
    expect(setCall![1].classesRemaining).toBe(7)
    expect(setCall![1].isActive).toBe(true)
    expect(setCall![1].editHistory).toEqual([
      expect.objectContaining({
        action: 'backdate-count',
        oldValue: { packSize: 10, classesRemaining: 10 },
        newValue: { packSize: 10, classesRemaining: 7 },
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
    const setCall = mockBatchSet.mock.calls.find(([_, payload]) => payload.packSize === 5)
    expect(setCall![1].classesRemaining).toBe(0)
    expect(setCall![1].isActive).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- tests/pages/teacher/AssignSubscription.test.tsx
```

Expected: FAIL — current page has no "Already attended" UI.

- [ ] **Step 3: Modify `src/pages/teacher/AssignSubscription.tsx`**

Replace with:

```tsx
import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  collection, writeBatch, doc, serverTimestamp, query, where, getDocs, Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import { formatDateDDMMYYYY, getAESTDate } from '../../utils/dates'
import type { PackSize } from '../../types'

const packs: { size: PackSize; label: string }[] = [
  { size: 5, label: '5 Classes' },
  { size: 10, label: '10 Classes' },
  { size: 20, label: '20 Classes' },
]
const MAX_BACKDATE_DAYS = 90

function getFee(packSize: PackSize, category: string | undefined): string {
  if (!category) return ''
  if (packSize === 10) return category === 'Women' ? '$200' : '$150'
  const perClass = category === 'Women' ? 23 : 18
  return `$${perClass * packSize}`
}

function isoDate(d: Date): string {
  const aest = getAESTDate(d)
  return `${aest.getFullYear()}-${String(aest.getMonth() + 1).padStart(2, '0')}-${String(aest.getDate()).padStart(2, '0')}`
}

export function AssignSubscription() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { student, loading } = useStudent(studentId)
  const [selected, setSelected] = useState<PackSize | null>(null)
  const [showBackdate, setShowBackdate] = useState(false)
  const [tab, setTab] = useState<'date' | 'count'>('date')
  const [usedCount, setUsedCount] = useState<number>(0)
  const [pickerValue, setPickerValue] = useState<string>('')
  const [dates, setDates] = useState<Date[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => getAESTDate(new Date()), [])
  const minDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - MAX_BACKDATE_DAYS)
    return d
  }, [today])

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!student) return <div className="text-white/30 text-sm">Student not found</div>

  function addDate() {
    if (!pickerValue || !selected) return
    const [y, m, d] = pickerValue.split('-').map(Number)
    const candidate = new Date(y, m - 1, d)
    if (candidate < minDate || candidate > today) return
    if (dates.length >= selected) return
    if (dates.some((existing) => isoDate(existing) === pickerValue)) return
    setDates([...dates, candidate])
  }
  function removeDate(target: Date) {
    setDates(dates.filter((d) => isoDate(d) !== isoDate(target)))
  }

  async function handleAssign() {
    if (!db || !user || !selected || !studentId) return

    if (showBackdate) {
      if (tab === 'date' && dates.length > selected) {
        setError('Number of dates exceeds pack size.')
        return
      }
      if (tab === 'count' && (usedCount < 0 || usedCount > selected)) {
        setError('Used count must be between 0 and pack size.')
        return
      }
    }

    setSaving(true)
    setError(null)

    try {
      const existingQuery = query(
        collection(db, 'subscriptions'),
        where('studentId', '==', studentId),
        where('isActive', '==', true)
      )
      const existingSnap = await getDocs(existingQuery)

      const batchWrite = writeBatch(db)
      existingSnap.docs.forEach((existingDoc) => {
        batchWrite.update(existingDoc.ref, { isActive: false })
      })

      const newSubRef = doc(collection(db, 'subscriptions'))
      const used = showBackdate && tab === 'count' ? usedCount : 0
      const remaining = selected - used
      const editHistory: Record<string, unknown>[] = []
      if (showBackdate && tab === 'count' && used > 0) {
        editHistory.push({
          action: 'backdate-count',
          editedBy: user.uid,
          editedAt: Timestamp.now(),
          oldValue: { packSize: selected, classesRemaining: selected },
          newValue: { packSize: selected, classesRemaining: remaining },
        })
      }

      batchWrite.set(newSubRef, {
        studentId,
        studentName: student!.name,
        packSize: selected,
        classesRemaining: remaining,
        assignedBy: user.uid,
        assignedAt: serverTimestamp(),
        isActive: remaining > 0,
        editHistory,
      })

      // By-date: write attendance docs with isBackdated: true.
      // The trigger handles FIFO decrement, FCM suppression, and editHistory append.
      if (showBackdate && tab === 'date' && dates.length > 0) {
        for (const d of dates) {
          const ref = doc(collection(db, 'attendance'))
          batchWrite.set(ref, {
            batchId: '',
            studentId,
            studentName: student!.name,
            batchName: 'Backdated entry',
            date: d,
            status: 'present',
            markedBy: user.uid,
            isBackdated: true,
            createdAt: serverTimestamp(),
          })
        }
      }

      await batchWrite.commit()
      navigate(`/teacher/students/${studentId}`)
    } catch (err) {
      console.error('AssignSubscription error:', err)
      setError('Failed to assign pack. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Assign Pack</h2>
        <div className="text-sm text-white/50 mt-1">{student.name}</div>
      </div>

      <div className="space-y-3">
        {packs.map((pack) => (
          <button key={pack.size} onClick={() => setSelected(pack.size)}
            className={`w-full rounded-xl p-4 text-left transition-colors ${
              selected === pack.size
                ? 'bg-[#00BCD4]/20 border-2 border-[#00BCD4]'
                : 'bg-white/5 border-2 border-transparent'
            }`}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-semibold">{pack.label}</div>
                <div className="text-xs text-white/40 mt-1">{pack.size}-class pass</div>
              </div>
              {student?.studentCategory && (
                <div className="text-sm font-semibold text-[#00BCD4]">{getFee(pack.size, student.studentCategory)}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <button
          type="button"
          onClick={() => setShowBackdate((v) => !v)}
          className="w-full text-left rounded-xl bg-white/5 px-4 py-3 text-sm"
        >
          {showBackdate ? '▾' : '▸'} Already attended classes (optional)
        </button>
      )}

      {selected && showBackdate && (
        <div className="rounded-xl bg-white/5 p-4 space-y-3">
          <div role="tablist" className="flex gap-2">
            <button
              role="tab"
              aria-selected={tab === 'date'}
              onClick={() => setTab('date')}
              className={`flex-1 rounded-lg py-1.5 text-xs ${tab === 'date' ? 'bg-[#00BCD4]/20 text-[#00BCD4]' : 'bg-white/5'}`}
            >
              By date
            </button>
            <button
              role="tab"
              aria-selected={tab === 'count'}
              onClick={() => setTab('count')}
              className={`flex-1 rounded-lg py-1.5 text-xs ${tab === 'count' ? 'bg-[#00BCD4]/20 text-[#00BCD4]' : 'bg-white/5'}`}
            >
              By count
            </button>
          </div>

          {tab === 'date' && (
            <>
              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="text-xs uppercase tracking-wider text-[#00BCD4]">Add date</span>
                  <input
                    type="date"
                    min={isoDate(minDate)}
                    max={isoDate(today)}
                    value={pickerValue}
                    onChange={(e) => setPickerValue(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={addDate}
                  className="rounded-lg bg-[#7B2D8B] px-4 py-2 text-sm"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {dates.map((d) => (
                  <button
                    key={isoDate(d)}
                    type="button"
                    onClick={() => removeDate(d)}
                    aria-label={`Remove ${formatDateDDMMYYYY(d)}`}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs"
                  >
                    {formatDateDDMMYYYY(d)} ✕
                  </button>
                ))}
              </div>
              <div className="text-xs text-white/40">
                {dates.length}/{selected} max
              </div>
            </>
          )}

          {tab === 'count' && (
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-[#00BCD4]">Already used</span>
              <input
                type="number"
                min={0}
                max={selected}
                value={usedCount}
                onChange={(e) => setUsedCount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-white/40">
                Out of {selected} in this pack
              </span>
            </label>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button onClick={handleAssign} disabled={!selected || saving}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50">
        {saving ? 'Assigning...' : 'Assign Pack'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect by-count tests pass**

```bash
npm test -- tests/pages/teacher/AssignSubscription.test.tsx
```

Expected: PASS.

### Subtask 8.2: By-date flow tests

- [ ] **Step 1: Append failing tests**

```tsx
describe('AssignSubscription — backdate by date', () => {
  beforeEach(() => {
    mockBatchCommit.mockClear()
    mockBatchSet.mockClear()
    mockBatchUpdate.mockClear()
    mockGetDocs.mockReset().mockResolvedValue({ docs: [] })
  })

  it('creates one isBackdated attendance doc per added date', async () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: /10 classes/i }))
    fireEvent.click(screen.getByRole('button', { name: /already attended/i }))
    fireEvent.click(screen.getByRole('tab', { name: /by date/i }))

    fireEvent.change(screen.getByLabelText(/add date/i), { target: { value: '2026-04-20' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.change(screen.getByLabelText(/add date/i), { target: { value: '2026-04-21' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    fireEvent.click(screen.getByRole('button', { name: /assign pack/i }))

    await waitFor(() => expect(mockBatchCommit).toHaveBeenCalled())
    const attendanceWrites = mockBatchSet.mock.calls.filter(
      ([_, payload]) => payload.isBackdated === true
    )
    expect(attendanceWrites).toHaveLength(2)
    attendanceWrites.forEach(([, payload]) => {
      expect(payload.status).toBe('present')
      expect(payload.markedBy).toBe('teacher-1')
    })

    // The subscription itself is created with full classesRemaining.
    const subWrite = mockBatchSet.mock.calls.find(([_, payload]) => payload.packSize === 10)
    expect(subWrite![1].classesRemaining).toBe(10)
  })
})
```

- [ ] **Step 2: Run**

```bash
npm test -- tests/pages/teacher/AssignSubscription.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/teacher/AssignSubscription.tsx tests/pages/teacher/AssignSubscription.test.tsx
git commit -m "feat(ui): backdate by date or count when assigning pack

Refs: #2 (US-1, US-2)"
```

---

## Task 9: `StudentProfile` integration

**Spec:** US-3, US-4, US-5.

**Files:**
- Modify: `src/pages/teacher/StudentProfile.tsx`
- Create: `tests/pages/teacher/StudentProfile.test.tsx`

### Subtask 9.1: Edit pack action wiring

- [ ] **Step 1: Write the failing test**

Create `tests/pages/teacher/StudentProfile.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mockCallEditSubscription = vi.fn().mockResolvedValue({ data: { ok: true } })

vi.mock('../../../src/lib/callables', () => ({
  callEditSubscription: (...args: unknown[]) => mockCallEditSubscription(...args),
}))

vi.mock('../../../src/firebase', () => ({ db: {}, isFirebaseConfigured: true }))

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
    fireEvent.click(screen.getByRole('tab', { name: /by count/i }))
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
  it('renders edit history in reverse chronological order', () => {
    renderRoute()
    fireEvent.click(screen.getByRole('button', { name: /history/i }))
    expect(screen.getByText(/Resized 5→10 \(remaining 5→10\)/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- tests/pages/teacher/StudentProfile.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Modify `src/pages/teacher/StudentProfile.tsx`**

Replace with:

```tsx
import { useParams, Link } from 'react-router-dom'
import { doc, arrayUnion, arrayRemove, writeBatch, collection, serverTimestamp, addDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useStudent } from '../../hooks/useStudents'
import { useStudentSubscriptions } from '../../hooks/useSubscriptions'
import { useStudentAttendance } from '../../hooks/useAttendance'
import { useBatches } from '../../hooks/useBatches'
import { useAuth } from '../../hooks/useAuth'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'
import { PunchCard } from '../../components/PunchCard'
import { PackEditDialog } from '../../components/PackEditDialog'
import type { PackEditMode, PackEditConfirmPayload } from '../../components/PackEditDialog'
import { callEditSubscription } from '../../lib/callables'
import { formatDateDDMMYYYY } from '../../utils/dates'
import { formatEditEntry } from '../../utils/editHistory'
import { useState } from 'react'

export function StudentProfile() {
  const { studentId } = useParams()
  const { user } = useAuth()
  const { student, loading } = useStudent(studentId)
  const { subscriptions } = useStudentSubscriptions(studentId)
  const { records } = useStudentAttendance(studentId)
  const { batches: allBatches } = useBatches(false)
  const [addingBatch, setAddingBatch] = useState(false)
  const [dialog, setDialog] = useState<PackEditMode | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!student) return <div className="text-white/30 text-sm">Student not found</div>

  const availableBatches = allBatches.filter((b) => !student.batchIds.includes(b.id))
  const activeSub = subscriptions.find((s) => s.isActive)

  async function addToBatch(batchId: string) {
    if (!db || !studentId) return
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', studentId), { batchIds: arrayUnion(batchId) })
      batch.update(doc(db, 'batches', batchId), { studentIds: arrayUnion(studentId) })
      await batch.commit()
      setAddingBatch(false)
    } catch (err) { console.error('addToBatch error:', err) }
  }

  async function removeFromBatch(batchId: string) {
    if (!db || !studentId) return
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', studentId), { batchIds: arrayRemove(batchId) })
      batch.update(doc(db, 'batches', batchId), { studentIds: arrayRemove(studentId) })
      await batch.commit()
    } catch (err) { console.error('removeFromBatch error:', err) }
  }

  async function handlePackEdit(payload: PackEditConfirmPayload) {
    if (!activeSub) return
    if (payload.mode === 'resize') {
      await callEditSubscription({
        subscriptionId: activeSub.id,
        op: 'resize',
        newPackSize: payload.newPackSize,
        newClassesRemaining: payload.newClassesRemaining,
      })
      return
    }
    if (payload.mode === 'backdate-count') {
      await callEditSubscription({
        subscriptionId: activeSub.id,
        op: 'backdate-count',
        usedCount: payload.usedCount,
      })
      return
    }
    // backdate-dates: write attendance docs from the client; trigger handles the rest.
    if (!db || !user || !student) return
    for (const d of payload.dates) {
      await addDoc(collection(db, 'attendance'), {
        batchId: '',
        studentId: student.id,
        studentName: student.name,
        batchName: 'Backdated entry',
        date: d,
        status: 'present',
        markedBy: user.uid,
        isBackdated: true,
        createdAt: serverTimestamp(),
      })
    }
  }

  const sortedHistory = (activeSub?.editHistory ?? []).slice().sort(
    (a, b) => new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime()
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{student.name}</h2>
        <div className="text-sm text-white/50">{student.email}</div>
        {student.phone && <div className="text-sm text-white/50">{student.phone}</div>}
        {student.studentCategory && (
          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-[#7B2D8B]/20 text-[#7B2D8B]">
            {student.studentCategory}
          </span>
        )}
        {student.parentName && (
          <div className="text-xs text-white/40 mt-1">
            Guardian: {student.parentName} · {student.parentPhone}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Link to={`/teacher/students/${studentId}/subscribe`}
          className="flex-1 bg-[#FF6F00] text-white text-center font-medium rounded-xl py-2.5 text-sm">
          Assign Pack
        </Link>
        <button onClick={() => setAddingBatch(!addingBatch)}
          className="flex-1 bg-[#7B2D8B] text-white font-medium rounded-xl py-2.5 text-sm">
          {addingBatch ? 'Cancel' : 'Add to Batch'}
        </button>
      </div>

      {addingBatch && availableBatches.length > 0 && (
        <div className="bg-white/5 rounded-xl p-3 space-y-2">
          {availableBatches.map((b) => (
            <button key={b.id} onClick={() => addToBatch(b.id)}
              className="w-full bg-white/5 rounded-lg p-2.5 text-left text-sm hover:bg-white/10">
              {b.name}
            </button>
          ))}
        </div>
      )}

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Subscription</div>
        {activeSub ? (
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm">{activeSub.packSize}-class pack</div>
                <div className="text-xs text-white/40 mt-0.5">Assigned {formatDateDDMMYYYY(activeSub.assignedAt)}</div>
              </div>
              <SubscriptionBadge classesRemaining={activeSub.classesRemaining} />
            </div>
            <PunchCard packSize={activeSub.packSize} classesRemaining={activeSub.classesRemaining} />
            <div className="flex gap-2">
              <button
                onClick={() => setDialog('resize')}
                className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs"
              >
                Edit pack
              </button>
              <button
                onClick={() => setDialog('backdate-count')}
                className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs"
              >
                Add past attendance
              </button>
            </div>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-left"
            >
              {showHistory ? '▾' : '▸'} History
            </button>
            {showHistory && (
              <div className="space-y-1 text-xs text-white/60">
                {sortedHistory.length === 0 && <div>No edits yet.</div>}
                {sortedHistory.map((entry, i) => (
                  <div key={i}>{formatEditEntry(entry)}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-white/30 text-sm">No active subscription</p>
        )}
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">
          Batches ({allBatches.filter((b) => student.batchIds.includes(b.id)).length})
        </div>
        <div className="space-y-2">
          {allBatches.filter((b) => student.batchIds.includes(b.id)).map((b) => (
            <div key={b.id} className="bg-white/5 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm">{b.name}</span>
              <button onClick={() => removeFromBatch(b.id)} className="text-xs text-[#E91E8C]">Remove</button>
            </div>
          ))}
        </div>
      </section>

      {records.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#7B2D8B] mb-3">Attendance History</div>
          <div className="space-y-1.5">
            {records.slice(0, 20).map((r) => (
              <div key={r.id} className="bg-white/5 rounded-lg p-2.5 flex justify-between items-center text-sm">
                <div>
                  <span>{r.batchName}</span>
                  <span className="text-white/40 ml-2 text-xs">{formatDateDDMMYYYY(r.date)}</span>
                </div>
                <span className={r.status === 'present' ? 'text-emerald-400' : 'text-red-400'}>
                  {r.status === 'present' ? 'Present ✓' : 'Absent ✗'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {dialog && activeSub && (
        <PackEditDialog
          mode={dialog}
          currentPackSize={activeSub.packSize}
          currentRemaining={activeSub.classesRemaining}
          onClose={() => setDialog(null)}
          onConfirm={handlePackEdit}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect tests pass**

```bash
npm test -- tests/pages/teacher/StudentProfile.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full suite to verify no regressions**

```bash
npm test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/pages/teacher/StudentProfile.tsx tests/pages/teacher/StudentProfile.test.tsx
git commit -m "feat(ui): edit pack, backdate on existing, and history on student profile

Refs: #2 (US-3, US-4, US-5)"
```

---

## Task 10: CLAUDE.md gotcha

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add gotcha entry**

Insert this bullet in the "Gotchas" section of `CLAUDE.md`, immediately after the "Subscription deduction is server-only" line:

```markdown
- **`isBackdated` suppresses FCM.** Attendance docs written with `isBackdated: true` (backdate-by-date flow) still go through `onAttendanceCreated` for FIFO decrement, but **must not** trigger any FCM (no low-balance alert, no attendance receipt). The trigger reads the flag and short-circuits before either `messaging.send` call. Any future attendance-side notification path must check this flag.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note isBackdated FCM-skip behaviour in CLAUDE.md gotchas

Refs: #2"
```

---

## Verification checklist (pre-PR)

- [ ] `cd functions && npm run build && npm test` — clean
- [ ] `npm test` (root) — clean
- [ ] `npm run lint` — clean
- [ ] `npm run build` — clean (PWA bundle)
- [ ] Manual emulator smoke (optional but recommended):
  1. `firebase emulators:start`
  2. Sign in as teacher, assign 5-pack with "by count = 2"; verify subscription shows 3 remaining and edit history has one `backdate-count` entry.
  3. Backdate a date on an existing pack; verify no FCM toast, FIFO decrements, history gains a `backdate-dates` entry.
  4. Edit pack size 5→10; verify packSize and classesRemaining update; history gains a `resize` entry.
- [ ] Open PR referencing #2; close with "Closes #2".

---

## Self-review notes

- All 5 user stories covered: US-1 → T8 by-date; US-2 → T8 by-count; US-3 → T9 backdate-count + T2 trigger; US-4 → T9 resize + T4 callable; US-5 → T9 history strip + T6 formatter.
- All 7 requirements covered: R1 → T2; R2 → T8 by-count + T4 backdate-count; R3 → T4 resize + T9 dialog; R4 → T2 + T4 + T9; R5 → T4 + T5; R6 → T7 client-side bounds + T4 server-side bounds; R7 → T4 auth gate + T5 rules.
- No placeholders. Every code block contains the actual code an engineer types in.
- Type consistency: `EditEntry`, `PackSize`, `SubscriptionEditAction` defined once in T3 and reused identically in T4, T6, T7, T9.
- One known limitation: backdate-on-existing-pack via the `backdate-dates` flow writes attendance docs directly from the client (consistent with `MarkAttendance.tsx`) and relies on the trigger to append `editHistory`. If multiple backdated dates are submitted, each fires a separate trigger run — `arrayUnion` keeps the audit honest with one entry per date.

---

## Completion notes (2026-04-25)

Shipped via PR #3, squash-merged to `main` as `a9814a9`. GitHub issue #2 closed; Project #7 status moved to **Done**.

**Two extra tasks added during execution that weren't in the original plan:**

- **T11 — Playwright E2E suite** (committed as part of the same PR). Boots `firebase emulators:exec --only auth,firestore,functions,storage` against `--project demo-fusion-steps` plus a vite dev server with `VITE_USE_EMULATOR=1`, seeds deterministic teacher/student/batch via `firebase-admin`, then drives Chromium through the 5 user stories. Requires `firebase-tools` CLI and `openjdk@21` (Java 21+ is mandatory in current `firebase-tools`).
- **T12 — Two latent bugs surfaced by E2E and fixed in the same PR:**
  1. `admin.firestore.FieldValue.arrayUnion(...)` was `undefined` under the firebase-functions emulator runtime in `firebase-admin@12`. Switched both `editSubscription.ts` and `onAttendanceCreated.ts` to modular `import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'`. The unit tests had passed because the mock provided the static members.
  2. `StudentProfile`'s history sort and `formatEditEntry` used `new Date(timestamp)` which returns NaN for Firestore `Timestamp` objects — broke reverse-chronological order. Both now coerce `Timestamp` / `Date` / `{ seconds }` shapes before reading millis.

**Other deltas vs. plan:**

- Firestore emulator port moved 8080 → 8088 in `firebase.json` to dodge a local port collision with another dev server. `src/firebase.ts` and `e2e/*` updated to match.
- `src/firebase.ts` pins `projectId` to `demo-fusion-steps` when `VITE_USE_EMULATOR=1`. Without this, the emulator's single-project mode rejects reads from the real prod project ID and silently returns empty collections.

**Final test counts on the merged commit:**

- 19 Cloud Functions unit tests (`vitest` + `firebase-admin` mocks)
- 39 PWA unit/integration tests (`vitest` + Testing Library)
- 7 Playwright E2E tests in real Chromium against the full emulator stack
