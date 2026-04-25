import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

// Backdated attendance (`isBackdated: true`) feeds the FIFO decrement but MUST
// NOT trigger FCM — the teacher is recording past classes, not notifying the
// student. It also writes one audit row to the target subscription's
// `editHistory`. Any future attendance-side notification path must check this
// flag.
export const onAttendanceCreated = functions.firestore
  .document('attendance/{attendanceId}')
  .onCreate(async (snap) => {
    const data = snap.data()
    if (data.status !== 'present') return

    const isBackdated = data.isBackdated === true
    const db = getFirestore()

    // FIFO: oldest active subscription first
    const subsSnap = await db.collection('subscriptions')
      .where('studentId', '==', data.studentId)
      .where('isActive', '==', true)
      .orderBy('assignedAt', 'asc')
      .limit(1)
      .get()

    let newRemaining: number | null = null

    if (!subsSnap.empty) {
      const subDoc = subsSnap.docs[0]
      const subData = subDoc.data()
      const oldRemaining: number = subData.classesRemaining
      const packSize: number = subData.packSize
      newRemaining = oldRemaining - 1

      const updates: Record<string, unknown> = { classesRemaining: newRemaining }
      if (newRemaining <= 0) updates.isActive = false

      if (isBackdated) {
        updates.editHistory = FieldValue.arrayUnion({
          action: 'backdate-dates',
          editedBy: data.markedBy,
          editedAt: Timestamp.now(),
          oldValue: { packSize, classesRemaining: oldRemaining },
          newValue: { packSize, classesRemaining: newRemaining },
          dates: [data.date],
        })
      }

      await subDoc.ref.update(updates)
    }

    // Backdated attendance never fires FCM.
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
