/**
 * Seeds the Firebase emulator with deterministic test data for Playwright E2E.
 * Idempotent: safe to re-run.
 *
 * Run with the emulator already up. Required env:
 *   FIRESTORE_EMULATOR_HOST=localhost:8088
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
 *   GCLOUD_PROJECT=fusion-steps-test  (or any project id)
 */

// Emulator targets must be set BEFORE firebase-admin is imported / initialized,
// because the underlying gRPC client reads these env vars at startup.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8088'
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099'
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-fusion-steps'

import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-fusion-steps'

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID })
}

const auth = getAuth()
const db = getFirestore()

export const TEACHER = {
  email: 'teacher@test.local',
  password: 'test1234',
  uid: 'teacher-test-uid',
  name: 'Sriparna (Test)',
}

export const STUDENT = {
  email: 'student@test.local',
  password: 'test1234',
  uid: 'student-test-uid',
  name: 'Anika (Test)',
}

export const BATCH = {
  id: 'batch-test-id',
  name: 'Test Bollywood — Tuesday',
}

async function ensureUser(opts: { uid: string; email: string; password: string; displayName: string }) {
  try {
    await auth.getUser(opts.uid)
    await auth.updateUser(opts.uid, { email: opts.email, password: opts.password, displayName: opts.displayName })
  } catch {
    await auth.createUser({ uid: opts.uid, email: opts.email, password: opts.password, displayName: opts.displayName })
  }
}

async function reset() {
  // Delete all subscriptions and attendance for the test student so each run starts fresh.
  const collections = ['subscriptions', 'attendance']
  for (const coll of collections) {
    const snap = await db.collection(coll).where('studentId', '==', STUDENT.uid).get()
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    if (!snap.empty) await batch.commit()
  }
}

export async function seed() {
  await ensureUser({ uid: TEACHER.uid, email: TEACHER.email, password: TEACHER.password, displayName: TEACHER.name })
  await ensureUser({ uid: STUDENT.uid, email: STUDENT.email, password: STUDENT.password, displayName: STUDENT.name })

  await db.doc(`users/${TEACHER.uid}`).set({
    name: TEACHER.name,
    email: TEACHER.email,
    phone: '',
    role: 'teacher',
    batchIds: [],
    createdAt: FieldValue.serverTimestamp(),
    createdBy: TEACHER.uid,
  })

  await db.doc(`users/${STUDENT.uid}`).set({
    name: STUDENT.name,
    email: STUDENT.email,
    phone: '',
    role: 'student',
    batchIds: [BATCH.id],
    studentCategory: 'Children',
    enrollmentType: 'Term',
    parentName: 'Test Parent',
    parentPhone: '0400000000',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: TEACHER.uid,
  })

  await db.doc(`batches/${BATCH.id}`).set({
    name: BATCH.name,
    dayOfWeek: 'Tuesday',
    time: '17:00',
    style: 'Bollywood',
    level: 'Beginner',
    studentIds: [STUDENT.uid],
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  })

  await reset()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => {
      console.log('[seed] OK — teacher/student/batch created, subscriptions/attendance reset.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[seed] FAIL:', err)
      process.exit(1)
    })
}
