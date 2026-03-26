import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

export const createStudent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
  }

  const callerDoc = await admin.firestore().doc(`users/${context.auth.uid}`).get()
  if (callerDoc.data()?.role !== 'teacher') {
    throw new functions.https.HttpsError('permission-denied', 'Only teachers can create students')
  }

  const { name, email, phone } = data as { name: string; email: string; phone?: string }

  if (!name || !email) {
    throw new functions.https.HttpsError('invalid-argument', 'Name and email are required')
  }

  const userRecord = await admin.auth().createUser({
    email,
    displayName: name,
  })

  await admin.firestore().doc(`users/${userRecord.uid}`).set({
    name,
    email,
    phone: phone || '',
    role: 'student',
    batchIds: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: context.auth.uid,
  })

  // Send password reset email as invite via Firebase Auth REST API
  await admin.auth().generatePasswordResetLink(email)
  const apiKey = process.env.FIREBASE_API_KEY || functions.config().app?.api_key
  if (apiKey) {
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    })
  }

  return { uid: userRecord.uid }
})
