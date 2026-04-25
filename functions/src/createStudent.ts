import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

// Input validation constants
const MAX_NAME_LENGTH = 100
const MAX_PHONE_LENGTH = 20
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const createStudent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
  }

  const callerDoc = await admin.firestore().doc(`users/${context.auth.uid}`).get()
  if (callerDoc.data()?.role !== 'teacher') {
    throw new functions.https.HttpsError('permission-denied', 'Only teachers can create students')
  }

  const {
    name: rawName, email: rawEmail, phone: rawPhone,
    studentCategory, enrollmentType,
    parentName: rawParentName, parentPhone: rawParentPhone,
  } = data as {
    name: string; email: string; phone?: string
    studentCategory: 'Children' | 'Teen' | 'Women'
    enrollmentType: 'Term' | 'Casual'
    parentName?: string; parentPhone?: string
  }

  // Trim whitespace before validation
  const name = rawName?.trim()
  const email = rawEmail?.trim()
  const phone = rawPhone?.trim()
  const parentName = rawParentName?.trim() || ''
  const parentPhone = rawParentPhone?.trim() || ''

  if (!name || !email) {
    throw new functions.https.HttpsError('invalid-argument', 'Name and email are required')
  }

  // Input length and format validation
  if (name.length > MAX_NAME_LENGTH) {
    throw new functions.https.HttpsError('invalid-argument', `Name must be ${MAX_NAME_LENGTH} characters or fewer`)
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email address')
  }
  if (phone && phone.length > MAX_PHONE_LENGTH) {
    throw new functions.https.HttpsError('invalid-argument', `Phone must be ${MAX_PHONE_LENGTH} characters or fewer`)
  }

  const validCategories = ['Children', 'Teen', 'Women']
  if (!studentCategory || !validCategories.includes(studentCategory)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid student category is required')
  }
  const validEnrollments = ['Term', 'Casual']
  if (!enrollmentType || !validEnrollments.includes(enrollmentType)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid enrollment type is required')
  }
  if ((studentCategory === 'Children' || studentCategory === 'Teen') && !parentName) {
    throw new functions.https.HttpsError('invalid-argument', 'Parent/Guardian name is required for minors')
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
    studentCategory,
    enrollmentType,
    parentName,
    parentPhone,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: context.auth.uid,
  })

  // Generate a password reset link for the new student's invite flow.
  // Note: generatePasswordResetLink creates the link but does not send an email.
  // To deliver the invite, pass this link to a transactional email service.
  const resetLink = await admin.auth().generatePasswordResetLink(email)
  functions.logger.info(`Password reset link generated for new student ${userRecord.uid}`, { resetLink })

  return { uid: userRecord.uid }
})
