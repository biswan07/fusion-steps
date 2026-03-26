import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

export const onVideoCreated = functions.firestore
  .document('videos/{videoId}')
  .onCreate(async (snap) => {
    const data = snap.data()
    const batchIds: string[] = data.batchIds || []

    if (batchIds.length === 0) return

    const db = admin.firestore()

    const studentIds = new Set<string>()
    for (const batchId of batchIds) {
      const batchDoc = await db.doc(`batches/${batchId}`).get()
      const batchData = batchDoc.data()
      if (batchData?.studentIds) {
        batchData.studentIds.forEach((id: string) => studentIds.add(id))
      }
    }

    const promises = Array.from(studentIds).map(async (studentId) => {
      const userDoc = await db.doc(`users/${studentId}`).get()
      const fcmToken = userDoc.data()?.fcmToken
      if (!fcmToken) return

      try {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: 'New Video',
            body: `New video: ${data.title} — watch now!`,
          },
        })
      } catch (err) {
        console.warn(`FCM send failed for ${studentId}:`, err)
      }
    })

    await Promise.all(promises)
  })
