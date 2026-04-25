import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import {
  initializeFirestore, persistentLocalCache, memoryLocalCache, doc, updateDoc,
  connectFirestoreEmulator,
} from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getMessaging, isSupported, getToken } from 'firebase/messaging'

const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // In emulator mode, hard-pin the project ID to match the emulator's --project flag,
  // otherwise the emulator runs in single-project mode and rejects reads from the
  // app's real production project ID, returning empty collections.
  projectId: useEmulator ? 'demo-fusion-steps' : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null

export const auth = app ? getAuth(app) : null
// In emulator mode use memory cache so test runs don't carry IndexedDB state across.
export const db = app
  ? initializeFirestore(app, {
      localCache: useEmulator ? memoryLocalCache() : persistentLocalCache({}),
    })
  : null
export const storage = app ? getStorage(app) : null
export const functions = app ? getFunctions(app) : null

if (useEmulator && app && auth && db && storage && functions) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8088)
  connectFunctionsEmulator(functions, 'localhost', 5001)
  connectStorageEmulator(storage, 'localhost', 9199)

  console.info('[firebase] Emulator mode active (auth:9099, firestore:8088, functions:5001, storage:9199)')
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
