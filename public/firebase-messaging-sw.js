// Firebase Cloud Messaging Service Worker
// NOTE: Replace these values with your actual Firebase config for push notifications to work.
// These cannot use Vite env vars because service workers are not processed by the build pipeline.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: '',
  projectId: '',
  messagingSenderId: '',
  appId: '',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  if (title) {
    self.registration.showNotification(title, { body, icon: '/assets/icon-192x192.png' })
  }
})
