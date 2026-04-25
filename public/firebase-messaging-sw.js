// Firebase Cloud Messaging Service Worker.
// The four __VITE_FIREBASE_*__ identifiers are substituted at build time by the
// `fcm-sw-template` plugin in vite.config.ts. In dev, this file is served from
// public/ unprocessed — the typeof guards keep it from throwing and the empty
// apiKey suppresses initialisation. Background notifications therefore only
// work in production builds.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

const cfg = {
  apiKey: typeof __VITE_FIREBASE_API_KEY__ !== 'undefined' ? __VITE_FIREBASE_API_KEY__ : '',
  projectId: typeof __VITE_FIREBASE_PROJECT_ID__ !== 'undefined' ? __VITE_FIREBASE_PROJECT_ID__ : '',
  messagingSenderId: typeof __VITE_FIREBASE_MESSAGING_SENDER_ID__ !== 'undefined' ? __VITE_FIREBASE_MESSAGING_SENDER_ID__ : '',
  appId: typeof __VITE_FIREBASE_APP_ID__ !== 'undefined' ? __VITE_FIREBASE_APP_ID__ : '',
}

if (cfg.apiKey) {
  firebase.initializeApp(cfg)
  const messaging = firebase.messaging()
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {}
    if (title) {
      self.registration.showNotification(title, { body, icon: '/assets/icon-192x192.png' })
    }
  })
}
