import { defineConfig, devices } from '@playwright/test'

const PORT = 5173

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Boots emulators (auth/firestore/functions/storage), then vite dev pointed at the emulator
    // via VITE_USE_EMULATOR=1 wired in src/firebase.ts. Functions are sourced from functions/lib
    // (built by `cd functions && npm run build`). Java path set explicitly so this works on
    // machines that have openjdk@21 brewed but not on PATH.
    command:
      // Kill any leaked Firestore JVM from a prior aborted run before booting fresh emulators.
      "(pkill -9 -f 'cloud-firestore-emulator.*jar' 2>/dev/null; true) && " +
      'JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" ' +
      'firebase emulators:exec --only auth,firestore,functions,storage --project demo-fusion-steps ' +
      '"VITE_USE_EMULATOR=1 vite --port 5173 --strictPort"',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
