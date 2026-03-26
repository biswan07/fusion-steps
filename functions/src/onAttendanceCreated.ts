import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

export const onAttendanceCreated = functions.firestore
  .document('attendance/{attendanceId}')
  .onCreate(async (snap) => {
    const data = snap.data()
    if (data.status !== 'present') return

    const db = admin.firestore()

    // FIFO: oldest active subscription first
    const subsSnap = await db.collection('subscriptions')
      .where('studentId', '==', data.studentId)
      .where('isActive', '==', true)
      .orderBy('assignedAt', 'asc')
      .limit(1)
      .get()

    if (!subsSnap.empty) {
      const subDoc = subsSnap.docs[0]
      const subData = subDoc.data()
      const newRemaining = subData.classesRemaining - 1

      const updates: Record<string, unknown> = { classesRemaining: newRemaining }
      if (newRemaining <= 0) updates.isActive = false

      await subDoc.ref.update(updates)

      // Low-balance notification if ≤ 2 classes remaining
      if (newRemaining > 0 && newRemaining <= 2) {
        await sendNotification(
          data.studentId,
          'Low Balance',
          `You have ${newRemaining} class${newRemaining === 1 ? '' : 'es'} left — talk to Sriparna to top up`
        )
      }
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
