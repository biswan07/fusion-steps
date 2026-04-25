import { seed } from './seed'

async function waitForEmulator(host: string, port: number, label: string, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://${host}:${port}`)
      if (resp.status < 500) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`[global-setup] Emulator ${label} on ${host}:${port} did not become ready in ${timeoutMs}ms`)
}

export default async function globalSetup() {
  // Configured in playwright.config.ts via webServer env
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8088'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-fusion-steps'

  await waitForEmulator('localhost', 8088, 'firestore')
  await waitForEmulator('localhost', 9099, 'auth')

  console.log('[global-setup] emulators reachable, seeding…')
  await seed()
  console.log('[global-setup] seed complete')
}
