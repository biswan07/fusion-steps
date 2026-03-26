import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Inject Firebase config into the FCM service worker (public/firebase-messaging-sw.js)
  // The service worker can't access import.meta.env, so we use string replacement at build time.
  define: {
    '__VITE_FIREBASE_API_KEY__': JSON.stringify(process.env.VITE_FIREBASE_API_KEY || ''),
    '__VITE_FIREBASE_PROJECT_ID__': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || ''),
    '__VITE_FIREBASE_MESSAGING_SENDER_ID__': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
    '__VITE_FIREBASE_APP_ID__': JSON.stringify(process.env.VITE_FIREBASE_APP_ID || ''),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Fusion Steps — by Sriparna Dutta',
        short_name: 'Fusion Steps',
        description: 'Fusion Steps Dance Academy',
        theme_color: '#1A1A2E',
        background_color: '#1A1A2E',
        display: 'standalone',
        icons: [
          { src: '/assets/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: '/assets/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: '/assets/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/assets/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/assets/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/assets/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/assets/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/assets/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com/,
            handler: 'NetworkFirst',
            options: { cacheName: 'firestore-cache', expiration: { maxEntries: 50, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
