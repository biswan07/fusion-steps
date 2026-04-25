import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const FCM_SW = 'firebase-messaging-sw.js'
const FCM_SW_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

// Vite's `define` and env substitution don't touch files in public/, which is
// where firebase-messaging-sw.js must live so it registers at root scope. This
// plugin reads the SW after the build, substitutes __VITE_FIREBASE_*__ tokens
// with the resolved env values, and writes the result over dist/{file}.
function fcmSwTemplate(): Plugin {
  let env: Record<string, string> = {}
  return {
    name: 'fcm-sw-template',
    apply: 'build',
    configResolved(config) {
      env = loadEnv(config.mode, config.root, '')
    },
    closeBundle() {
      const src = resolve('public', FCM_SW)
      const out = resolve('dist', FCM_SW)
      if (!existsSync(src)) return
      let body = readFileSync(src, 'utf8')
      for (const key of FCM_SW_KEYS) {
        body = body.replace(new RegExp(`__${key}__`, 'g'), JSON.stringify(env[key] || ''))
      }
      writeFileSync(out, body)
      const missing = FCM_SW_KEYS.filter((k) => !env[k])
      if (missing.length) {
        this.warn(`${FCM_SW} built without: ${missing.join(', ')} — background FCM will be disabled.`)
      }
    },
  }
}

export default defineConfig({
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
    fcmSwTemplate(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.claude/**', 'functions/**'],
  },
})
