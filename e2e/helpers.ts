// Set emulator env BEFORE importing firebase-admin (gRPC reads these at startup).
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8088'
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099'
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-fusion-steps'

import { Page, expect } from '@playwright/test'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { TEACHER, STUDENT, BATCH } from './seed'

if (!getApps().length) {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT })
}

const db = getFirestore()

export async function signInAsTeacher(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder(/email or phone/i).fill(TEACHER.email)
  await page.getByPlaceholder(/password/i).fill(TEACHER.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/teacher\/dashboard/, { timeout: 15_000 })
}

export async function resetStudentData() {
  for (const coll of ['subscriptions', 'attendance']) {
    const snap = await db.collection(coll).where('studentId', '==', STUDENT.uid).get()
    if (snap.empty) continue
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}

export async function createActiveSubscription(opts: {
  packSize: 5 | 10 | 20
  classesRemaining: number
}) {
  const ref = db.collection('subscriptions').doc()
  await ref.set({
    studentId: STUDENT.uid,
    studentName: STUDENT.name,
    packSize: opts.packSize,
    classesRemaining: opts.classesRemaining,
    assignedBy: TEACHER.uid,
    assignedAt: FieldValue.serverTimestamp(),
    isActive: true,
    editHistory: [],
  })
  return ref.id
}

export async function getActiveSub() {
  const snap = await db
    .collection('subscriptions')
    .where('studentId', '==', STUDENT.uid)
    .where('isActive', '==', true)
    .orderBy('assignedAt', 'asc')
    .limit(1)
    .get()
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Record<string, unknown> & { id: string }
}

export async function getAllSubsForStudent() {
  const snap = await db
    .collection('subscriptions')
    .where('studentId', '==', STUDENT.uid)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getBackdatedAttendanceCount() {
  const snap = await db
    .collection('attendance')
    .where('studentId', '==', STUDENT.uid)
    .where('isBackdated', '==', true)
    .get()
  return snap.size
}

/**
 * Polls until the predicate returns truthy or timeout. Returns the resolved value.
 * Used to wait for Cloud Function trigger side effects in the emulator.
 */
export async function waitFor<T>(
  fn: () => Promise<T | null | undefined>,
  opts: { timeoutMs?: number; intervalMs?: number; description?: string } = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 15_000
  const intervalMs = opts.intervalMs ?? 500
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const val = await fn()
    if (val) return val
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms${opts.description ? `: ${opts.description}` : ''}`)
}

export { STUDENT, TEACHER, BATCH, expect }
