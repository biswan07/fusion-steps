import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence, doc, updateDoc } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getMessaging, isSupported, getToken } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null

export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export const storage = app ? getStorage(app) : null

// Enable offline persistence for Firestore
if (db) {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn('Firestore persistence failed:', err.code)
  })
}

// Messaging (conditional — not supported in all browsers)
export const getMessagingInstance = async () => {
  if (!app) return null
  const supported = await isSupported()
  return supported ? getMessaging(app) : null
}

export async function requestNotificationPermission(userId: string) {
  const messaging = await getMessagingInstance()
  if (!messaging || !db) return

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

  try {
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    })
    await updateDoc(doc(db, 'users', userId), { fcmToken: token })
  } catch (err) {
    console.warn('FCM token registration failed:', err)
  }
}
