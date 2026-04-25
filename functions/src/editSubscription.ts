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
        packSize: PackSize
        classesRemaining: number
        isActive: boolean
        studentId: string
      }

      if (data.op === 'resize') {
        if (!VALID_PACK_SIZES.includes(data.newPackSize)) {
          throw new functions.https.HttpsError('invalid-argument', 'Invalid pack size')
        }
        if (
          typeof data.newClassesRemaining !== 'number' ||
          !Number.isInteger(data.newClassesRemaining) ||
          data.newClassesRemaining < 0 ||
          data.newClassesRemaining > data.newPackSize
        ) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            `newClassesRemaining must be 0..${data.newPackSize}`,
          )
        }

        txn.update(subRef, {
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
        })
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
            `usedCount must be 1..${MAX_BACKDATE_COUNT}`,
          )
        }
        if (data.usedCount > sub.classesRemaining) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `usedCount (${data.usedCount}) exceeds classesRemaining (${sub.classesRemaining})`,
          )
        }
        const newRemaining = sub.classesRemaining - data.usedCount
        txn.update(subRef, {
          classesRemaining: newRemaining,
          isActive: newRemaining > 0,
          editHistory: admin.firestore.FieldValue.arrayUnion({
            action: 'backdate-count',
            editedBy: callerUid,
            editedAt: admin.firestore.Timestamp.now(),
            oldValue: { packSize: sub.packSize, classesRemaining: sub.classesRemaining },
            newValue: { packSize: sub.packSize, classesRemaining: newRemaining },
          }),
        })
        return { ok: true }
      }

      throw new functions.https.HttpsError('invalid-argument', 'Unknown op')
    })
  },
)
