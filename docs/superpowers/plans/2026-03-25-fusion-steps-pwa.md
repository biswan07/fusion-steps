# Fusion Steps PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA for Fusion Steps Dance Academy with teacher (admin) and student roles, covering batch/student management, attendance tracking with auto-deduction, subscription management, video library, and push notifications.

**Architecture:** React + TypeScript SPA with Firebase backend (Auth, Firestore, Storage, Cloud Messaging). Flat Firestore collections with denormalization. 3 Cloud Functions for student creation, attendance processing, and video notifications. PWA with read-only offline via Workbox.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Firebase (Auth, Firestore, Storage, FCM), Cloud Functions (Node.js), vite-plugin-pwa, Vitest, React Testing Library

---

## File Structure

```
fusion-steps/
├── .env.example                          # Firebase config placeholder
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
├── firestore.rules
├── firebase.json
├── public/
│   ├── assets/                           # Logo + PWA icons (already generated)
│   └── firebase-messaging-sw.js          # FCM service worker
├── functions/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                      # Cloud Function exports
│       ├── createStudent.ts              # Callable: create student account
│       ├── onAttendanceCreated.ts        # Trigger: deduct + notify
│       └── onVideoCreated.ts            # Trigger: notify batch students
├── src/
│   ├── main.tsx                          # App entry point
│   ├── App.tsx                           # Router + AuthProvider
│   ├── firebase.ts                       # Firebase init + helpers
│   ├── types.ts                          # Shared TypeScript types
│   ├── utils/
│   │   ├── dates.ts                      # DD/MM/YYYY formatting (AEST)
│   │   └── subscriptions.ts             # Balance helpers
│   ├── hooks/
│   │   ├── useAuth.ts                    # Auth context + hook
│   │   ├── useBatches.ts                # Firestore batch queries
│   │   ├── useStudents.ts               # Firestore student queries
│   │   ├── useAttendance.ts             # Firestore attendance queries
│   │   ├── useSubscriptions.ts          # Firestore subscription queries
│   │   ├── useVideos.ts                 # Firestore video queries
│   │   └── useOnlineStatus.ts           # Online/offline detection
│   ├── components/
│   │   ├── AppHeader.tsx                 # Logo + profile avatar
│   │   ├── ProtectedRoute.tsx            # Role-based route guard
│   │   ├── SubscriptionBadge.tsx         # Colour-coded pill
│   │   ├── BatchCard.tsx                 # Batch summary card
│   │   ├── VideoCard.tsx                 # Video thumbnail card
│   │   ├── OfflineBanner.tsx             # "You're offline" banner
│   │   └── SetupScreen.tsx              # Firebase not configured screen
│   ├── layouts/
│   │   ├── TeacherLayout.tsx             # Teacher bottom tab nav
│   │   └── StudentLayout.tsx            # Student bottom tab nav
│   └── pages/
│       ├── LoginPage.tsx
│       ├── teacher/
│       │   ├── TeacherDashboard.tsx
│       │   ├── BatchList.tsx
│       │   ├── BatchDetail.tsx
│       │   ├── MarkAttendance.tsx
│       │   ├── StudentList.tsx
│       │   ├── StudentProfile.tsx
│       │   ├── AssignSubscription.tsx
│       │   ├── VideoList.tsx
│       │   └── VideoUpload.tsx
│       └── student/
│           ├── StudentHome.tsx
│           ├── AttendanceHistory.tsx
│           ├── VideoLibrary.tsx
│           └── StudentProfilePage.tsx
└── tests/
    ├── utils/
    │   ├── dates.test.ts
    │   └── subscriptions.test.ts
    ├── components/
    │   ├── SubscriptionBadge.test.tsx
    │   └── ProtectedRoute.test.tsx
    └── pages/
        └── teacher/
            └── MarkAttendance.test.tsx
```

---

## Task 1: Project Scaffolding & Firebase Config

**Files:**
- Create: `package.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `index.html`, `.env.example`, `firebase.json`, `src/main.tsx`, `src/App.tsx`, `src/firebase.ts`, `src/types.ts`

- [ ] **Step 1: Scaffold Vite + React + TypeScript project**

```bash
cd "/Users/biswanathdutta/Documents/claude_code/fusion steps"
npm create vite@latest . -- --template react-ts
```

If prompted about existing files, select to overwrite. The `public/assets/` directory with icons will be preserved.

- [ ] **Step 2: Install dependencies**

```bash
npm install firebase react-router-dom
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom vite-plugin-pwa
```

- [ ] **Step 3: Configure Tailwind CSS**

Replace `src/index.css` with:

```css
@import "tailwindcss";
```

Add Tailwind Vite plugin to `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
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
})
```

- [ ] **Step 4: Create `.env.example`**

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

- [ ] **Step 5: Create shared types**

Write `src/types.ts`:

```ts
export type UserRole = 'teacher' | 'student'
export type DanceStyle = 'Bollywood' | 'Western' | 'Fusion'
export type BatchLevel = 'Beginner' | 'Intermediate' | 'Advanced'
export type AttendanceStatus = 'present' | 'absent'
export type PackSize = 5 | 10 | 20

export interface AppUser {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  batchIds: string[]
  fcmToken?: string
  createdAt: Date
  createdBy: string
}

export interface Batch {
  id: string
  name: string
  dayOfWeek: string
  time: string
  style: DanceStyle
  level: BatchLevel
  studentIds: string[]
  isActive: boolean
  createdAt: Date
}

export interface AttendanceRecord {
  id: string
  batchId: string
  studentId: string
  studentName: string
  batchName: string
  date: Date
  status: AttendanceStatus
  markedBy: string
  createdAt: Date
}

export interface Subscription {
  id: string
  studentId: string
  studentName: string
  packSize: PackSize
  classesRemaining: number
  assignedBy: string
  assignedAt: Date
  isActive: boolean
}

export interface Video {
  id: string
  title: string
  description: string
  style: DanceStyle
  batchIds: string[]
  storageUrl: string
  thumbnailUrl: string
  uploadedBy: string
  uploadedAt: Date
}
```

- [ ] **Step 6: Create Firebase init**

Write `src/firebase.ts`:

```ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getMessaging, isSupported } from 'firebase/messaging'

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
```

- [ ] **Step 7: Update `index.html`**

Add Google Fonts and meta tags:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#1A1A2E" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="apple-touch-icon" href="/assets/icon-192x192.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>Fusion Steps — by Sriparna Dutta</title>
  </head>
  <body class="bg-[#1A1A2E] text-white font-['Inter']">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Verify project builds**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript project with Firebase and Tailwind"
```

---

## Task 2: Utility Functions + Tests

**Files:**
- Create: `src/utils/dates.ts`, `src/utils/subscriptions.ts`, `tests/utils/dates.test.ts`, `tests/utils/subscriptions.test.ts`

- [ ] **Step 1: Write failing tests for date utilities**

Write `tests/utils/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatDateDDMMYYYY, getGreeting, getAESTDate } from '../../src/utils/dates'

describe('formatDateDDMMYYYY', () => {
  it('formats a date as DD/MM/YYYY', () => {
    const date = new Date('2026-03-25T10:00:00Z')
    expect(formatDateDDMMYYYY(date)).toBe('25/03/2026')
  })

  it('pads single-digit day and month', () => {
    const date = new Date('2026-01-05T10:00:00Z')
    expect(formatDateDDMMYYYY(date)).toBe('05/01/2026')
  })
})

describe('getGreeting', () => {
  it('returns Good morning before noon', () => {
    expect(getGreeting(9)).toBe('Good morning')
  })

  it('returns Good afternoon between noon and 5pm', () => {
    expect(getGreeting(14)).toBe('Good afternoon')
  })

  it('returns Good evening after 5pm', () => {
    expect(getGreeting(19)).toBe('Good evening')
  })
})
```

- [ ] **Step 2: Configure Vitest**

Add to `vite.config.ts` (inside `defineConfig`):

```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: [],
},
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- tests/utils/dates.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement date utilities**

Write `src/utils/dates.ts`:

```ts
/**
 * Format a Date as DD/MM/YYYY in AEST timezone.
 */
export function formatDateDDMMYYYY(date: Date): string {
  const aest = getAESTDate(date)
  const day = String(aest.getDate()).padStart(2, '0')
  const month = String(aest.getMonth() + 1).padStart(2, '0')
  const year = aest.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Get a Date object adjusted to AEST (UTC+10) / AEDT (UTC+11).
 * Uses Intl to determine the correct offset.
 */
export function getAESTDate(date: Date): Date {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0'
  return new Date(
    parseInt(get('year')),
    parseInt(get('month')) - 1,
    parseInt(get('day')),
    parseInt(get('hour')),
    parseInt(get('minute')),
    parseInt(get('second'))
  )
}

/**
 * Return a greeting based on hour of day.
 */
export function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Get the current day of week name (e.g., "Wednesday") in AEST.
 */
export function getCurrentDayAEST(): string {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'long',
  })
  return formatter.format(new Date())
}
```

- [ ] **Step 5: Run date tests to verify they pass**

```bash
npm test -- tests/utils/dates.test.ts
```

Expected: PASS

- [ ] **Step 6: Write failing tests for subscription utilities**

Write `tests/utils/subscriptions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getBalanceColor, getBalanceLabel, isLowBalance } from '../../src/utils/subscriptions'

describe('getBalanceColor', () => {
  it('returns red for 0-2 classes', () => {
    expect(getBalanceColor(0)).toBe('red')
    expect(getBalanceColor(1)).toBe('red')
    expect(getBalanceColor(2)).toBe('red')
  })

  it('returns orange for 3-4 classes', () => {
    expect(getBalanceColor(3)).toBe('orange')
    expect(getBalanceColor(4)).toBe('orange')
  })

  it('returns green for 5+ classes', () => {
    expect(getBalanceColor(5)).toBe('green')
    expect(getBalanceColor(20)).toBe('green')
  })
})

describe('isLowBalance', () => {
  it('returns true for 2 or fewer', () => {
    expect(isLowBalance(2)).toBe(true)
    expect(isLowBalance(0)).toBe(true)
  })

  it('returns false for 3 or more', () => {
    expect(isLowBalance(3)).toBe(false)
  })
})
```

- [ ] **Step 7: Run subscription tests to verify they fail**

```bash
npm test -- tests/utils/subscriptions.test.ts
```

Expected: FAIL

- [ ] **Step 8: Implement subscription utilities**

Write `src/utils/subscriptions.ts`:

```ts
export type BalanceColor = 'red' | 'orange' | 'green'

export function getBalanceColor(classesRemaining: number): BalanceColor {
  if (classesRemaining <= 2) return 'red'
  if (classesRemaining <= 4) return 'orange'
  return 'green'
}

export function isLowBalance(classesRemaining: number): boolean {
  return classesRemaining <= 2
}

export function getBalanceLabel(classesRemaining: number): string {
  if (classesRemaining === 0) return 'No classes left'
  if (classesRemaining === 1) return '1 class left'
  return `${classesRemaining} classes left`
}
```

- [ ] **Step 9: Run all tests to verify they pass**

```bash
npm test
```

Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/utils/ tests/utils/
git commit -m "feat: add date and subscription utility functions with tests"
```

---

## Task 3: Auth Context + Protected Routes

**Files:**
- Create: `src/hooks/useAuth.ts`, `src/components/ProtectedRoute.tsx`, `src/components/SetupScreen.tsx`, `tests/components/ProtectedRoute.test.tsx`

- [ ] **Step 1: Write failing test for ProtectedRoute**

Write `tests/components/ProtectedRoute.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProtectedRoute } from '../../src/components/ProtectedRoute'
import { AuthContext, AuthState } from '../../src/hooks/useAuth'

function renderWithAuth(authState: AuthState, element: React.ReactElement) {
  return render(
    <AuthContext.Provider value={authState}>
      <MemoryRouter>{element}</MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('ProtectedRoute', () => {
  it('shows loading when auth is loading', () => {
    renderWithAuth(
      { user: null, role: null, loading: true },
      <ProtectedRoute requiredRole="teacher"><div>Secret</div></ProtectedRoute>
    )
    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
  })

  it('renders children when role matches', () => {
    renderWithAuth(
      { user: { uid: '1' } as any, role: 'teacher', loading: false },
      <ProtectedRoute requiredRole="teacher"><div>Teacher Content</div></ProtectedRoute>
    )
    expect(screen.getByText('Teacher Content')).toBeInTheDocument()
  })

  it('does not render children when role mismatches', () => {
    renderWithAuth(
      { user: { uid: '1' } as any, role: 'student', loading: false },
      <ProtectedRoute requiredRole="teacher"><div>Teacher Content</div></ProtectedRoute>
    )
    expect(screen.queryByText('Teacher Content')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/components/ProtectedRoute.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement AuthContext**

Write `src/hooks/useAuth.ts`:

```ts
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import type { UserRole } from '../types'

export interface AuthState {
  user: User | null
  role: UserRole | null
  loading: boolean
}

export const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthProvider(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
  })

  useEffect(() => {
    if (!auth) {
      setState({ user: null, role: null, loading: false })
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && db) {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const role = (userDoc.data()?.role as UserRole) || null
        setState({ user, role, loading: false })
      } else {
        setState({ user: null, role: null, loading: false })
      }
    })

    return unsubscribe
  }, [])

  return state
}
```

- [ ] **Step 4: Implement ProtectedRoute**

Write `src/components/ProtectedRoute.tsx`:

```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types'

interface Props {
  requiredRole: UserRole
  children: React.ReactNode
}

export function ProtectedRoute({ requiredRole, children }: Props) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-[#00BCD4] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (role !== requiredRole) {
    const redirect = role === 'teacher' ? '/teacher/dashboard' : '/student/home'
    return <Navigate to={redirect} replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 5: Implement SetupScreen**

Write `src/components/SetupScreen.tsx`:

```tsx
export function SetupScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <img src="/assets/logo.png" alt="Fusion Steps" className="w-32 h-32 mb-6 rounded-full" />
      <h1 className="font-['Dancing_Script'] text-3xl text-[#00BCD4] mb-2">Fusion Steps</h1>
      <p className="text-white/50 mb-8">by Sriparna Dutta</p>
      <div className="bg-white/5 rounded-2xl p-6 max-w-md">
        <h2 className="text-lg font-semibold mb-4">Firebase Not Configured</h2>
        <p className="text-white/60 text-sm mb-4">
          To get started, create a Firebase project and add your config to a <code className="text-[#00BCD4]">.env</code> file.
        </p>
        <ol className="text-left text-sm text-white/60 space-y-2 list-decimal list-inside">
          <li>Go to the Firebase Console and create a new project</li>
          <li>Enable Authentication (Email/Password)</li>
          <li>Create a Firestore database</li>
          <li>Enable Storage</li>
          <li>Copy <code className="text-[#00BCD4]">.env.example</code> to <code className="text-[#00BCD4]">.env</code> and fill in your Firebase config</li>
          <li>Restart the dev server</li>
        </ol>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Add test setup for @testing-library**

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Update `vite.config.ts` test config:

```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./tests/setup.ts'],
},
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAuth.ts src/components/ProtectedRoute.tsx src/components/SetupScreen.tsx tests/
git commit -m "feat: add auth context, protected routes, and setup screen"
```

---

## Task 4: Layouts + Navigation + Login Page

**Files:**
- Create: `src/layouts/TeacherLayout.tsx`, `src/layouts/StudentLayout.tsx`, `src/pages/LoginPage.tsx`, `src/components/AppHeader.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement AppHeader**

Write `src/components/AppHeader.tsx`:

```tsx
import { useAuth } from '../hooks/useAuth'

export function AppHeader() {
  const { user } = useAuth()

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
      <div className="flex items-center gap-3">
        <img src="/assets/icon-72x72.png" alt="Fusion Steps" className="w-9 h-9 rounded-full" />
        <div>
          <div className="font-['Dancing_Script'] text-lg text-[#00BCD4]">Fusion Steps</div>
          <div className="text-[10px] text-white/50">by Sriparna Dutta</div>
        </div>
      </div>
      {user && (
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
          {user.email?.[0].toUpperCase() || '?'}
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Implement TeacherLayout**

Write `src/layouts/TeacherLayout.tsx`:

```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { OfflineBanner } from '../components/OfflineBanner'

const tabs = [
  { to: '/teacher/dashboard', label: 'Home', icon: '🏠' },
  { to: '/teacher/batches', label: 'Batches', icon: '📋' },
  { to: '/teacher/students', label: 'Students', icon: '👥' },
  { to: '/teacher/videos', label: 'Videos', icon: '🎬' },
]

export function TeacherLayout() {
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <AppHeader />
      <OfflineBanner />
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-[#1A1A2E] border-t border-white/10 max-w-lg mx-auto">
        <div className="flex justify-around py-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-1 px-3 text-xs ${isActive ? 'text-[#00BCD4]' : 'text-white/40'}`
              }
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="mt-0.5">{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
```

- [ ] **Step 3: Implement StudentLayout**

Write `src/layouts/StudentLayout.tsx`:

```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { OfflineBanner } from '../components/OfflineBanner'

const tabs = [
  { to: '/student/home', label: 'Home', icon: '🏠' },
  { to: '/student/attendance', label: 'Attendance', icon: '📅' },
  { to: '/student/videos', label: 'Videos', icon: '🎬' },
  { to: '/student/profile', label: 'Profile', icon: '👤' },
]

export function StudentLayout() {
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <AppHeader />
      <OfflineBanner />
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-[#1A1A2E] border-t border-white/10 max-w-lg mx-auto">
        <div className="flex justify-around py-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-1 px-3 text-xs ${isActive ? 'text-[#00BCD4]' : 'text-white/40'}`
              }
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="mt-0.5">{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
```

- [ ] **Step 4: Implement OfflineBanner**

Write `src/components/OfflineBanner.tsx`:

```tsx
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="bg-[#FF6F00] text-white text-center text-sm py-1.5 px-4">
      You're offline — viewing cached data
    </div>
  )
}
```

Write `src/hooks/useOnlineStatus.ts`:

```ts
import { useState, useEffect } from 'react'

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
```

- [ ] **Step 5: Implement LoginPage**

Write `src/pages/LoginPage.tsx`:

```tsx
import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!auth || !db) return

    setLoading(true)
    setError('')

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid))
      const role = userDoc.data()?.role

      if (role === 'teacher') {
        navigate('/teacher/dashboard', { replace: true })
      } else {
        navigate('/student/home', { replace: true })
      }
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <img src="/assets/logo.png" alt="Fusion Steps" className="w-28 h-28 rounded-full mb-4" />
      <h1 className="font-['Dancing_Script'] text-3xl text-[#00BCD4] mb-1">Fusion Steps</h1>
      <p className="text-white/50 text-sm mb-8">by Sriparna Dutta</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]"
        />
        {error && <p className="text-[#E91E8C] text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Wire up App.tsx with router**

Write `src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SetupScreen } from './components/SetupScreen'
import { isFirebaseConfigured } from './firebase'
import { TeacherLayout } from './layouts/TeacherLayout'
import { StudentLayout } from './layouts/StudentLayout'
import { LoginPage } from './pages/LoginPage'
import { TeacherDashboard } from './pages/teacher/TeacherDashboard'
import { BatchList } from './pages/teacher/BatchList'
import { BatchDetail } from './pages/teacher/BatchDetail'
import { MarkAttendance } from './pages/teacher/MarkAttendance'
import { StudentList } from './pages/teacher/StudentList'
import { StudentProfile } from './pages/teacher/StudentProfile'
import { AssignSubscription } from './pages/teacher/AssignSubscription'
import { VideoList } from './pages/teacher/VideoList'
import { VideoUpload } from './pages/teacher/VideoUpload'
import { StudentHome } from './pages/student/StudentHome'
import { AttendanceHistory } from './pages/student/AttendanceHistory'
import { VideoLibrary } from './pages/student/VideoLibrary'
import { StudentProfilePage } from './pages/student/StudentProfilePage'

export default function App() {
  const authState = useAuthProvider()

  if (!isFirebaseConfigured) return <SetupScreen />

  return (
    <AuthContext.Provider value={authState}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/teacher" element={<ProtectedRoute requiredRole="teacher"><TeacherLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="batches" element={<BatchList />} />
            <Route path="batches/:batchId" element={<BatchDetail />} />
            <Route path="batches/:batchId/attendance" element={<MarkAttendance />} />
            <Route path="students" element={<StudentList />} />
            <Route path="students/:studentId" element={<StudentProfile />} />
            <Route path="students/:studentId/subscribe" element={<AssignSubscription />} />
            <Route path="videos" element={<VideoList />} />
            <Route path="videos/upload" element={<VideoUpload />} />
          </Route>

          <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<StudentHome />} />
            <Route path="attendance" element={<AttendanceHistory />} />
            <Route path="videos" element={<VideoLibrary />} />
            <Route path="profile" element={<StudentProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 7: Create placeholder pages**

Create stub components for all pages so the app compiles. Each file exports a component that returns a placeholder:

For each of these files, create with pattern:

```tsx
export function ComponentName() {
  return <div className="text-white/50">ComponentName — coming soon</div>
}
```

Files to create:
- `src/pages/teacher/TeacherDashboard.tsx`
- `src/pages/teacher/BatchList.tsx`
- `src/pages/teacher/BatchDetail.tsx`
- `src/pages/teacher/MarkAttendance.tsx`
- `src/pages/teacher/StudentList.tsx`
- `src/pages/teacher/StudentProfile.tsx`
- `src/pages/teacher/AssignSubscription.tsx`
- `src/pages/teacher/VideoList.tsx`
- `src/pages/teacher/VideoUpload.tsx`
- `src/pages/student/StudentHome.tsx`
- `src/pages/student/AttendanceHistory.tsx`
- `src/pages/student/VideoLibrary.tsx`
- `src/pages/student/StudentProfilePage.tsx`

- [ ] **Step 8: Verify build succeeds**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add src/ tests/
git commit -m "feat: add layouts, navigation, login page, and app router"
```

---

## Task 5: Firestore Hooks

**Files:**
- Create: `src/hooks/useBatches.ts`, `src/hooks/useStudents.ts`, `src/hooks/useAttendance.ts`, `src/hooks/useSubscriptions.ts`, `src/hooks/useVideos.ts`

- [ ] **Step 1: Implement useBatches hook**

Write `src/hooks/useBatches.ts`:

```ts
import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import type { Batch } from '../types'

function toBatch(id: string, data: any): Batch {
  return { id, ...data, createdAt: data.createdAt?.toDate() || new Date() }
}

export function useBatches(activeOnly = true) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) return
    const constraints = activeOnly
      ? [where('isActive', '==', true), orderBy('dayOfWeek')]
      : [orderBy('dayOfWeek')]
    const q = query(collection(db, 'batches'), ...constraints)
    const unsubscribe = onSnapshot(q, (snap) => {
      setBatches(snap.docs.map((d) => toBatch(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [activeOnly])

  return { batches, loading }
}

export function useBatch(batchId: string | undefined) {
  const [batch, setBatch] = useState<Batch | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !batchId) return
    getDoc(doc(db, 'batches', batchId)).then((snap) => {
      setBatch(snap.exists() ? toBatch(snap.id, snap.data()) : null)
      setLoading(false)
    })
  }, [batchId])

  return { batch, loading }
}

export function useStudentBatches(batchIds: string[]) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || batchIds.length === 0) {
      setBatches([])
      setLoading(false)
      return
    }
    const q = query(collection(db, 'batches'), where('__name__', 'in', batchIds))
    const unsubscribe = onSnapshot(q, (snap) => {
      setBatches(snap.docs.map((d) => toBatch(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [batchIds.join(',')])

  return { batches, loading }
}
```

- [ ] **Step 2: Implement useStudents hook**

Write `src/hooks/useStudents.ts`:

```ts
import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import type { AppUser } from '../types'

function toUser(id: string, data: any): AppUser {
  return { id, ...data, createdAt: data.createdAt?.toDate() || new Date() }
}

export function useStudents() {
  const [students, setStudents] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) return
    const q = query(collection(db, 'users'), where('role', '==', 'student'), orderBy('name'))
    const unsubscribe = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => toUser(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return { students, loading }
}

export function useStudent(studentId: string | undefined) {
  const [student, setStudent] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !studentId) return
    const unsubscribe = onSnapshot(doc(db, 'users', studentId), (snap) => {
      setStudent(snap.exists() ? toUser(snap.id, snap.data()) : null)
      setLoading(false)
    })
    return unsubscribe
  }, [studentId])

  return { student, loading }
}

export function useBatchStudents(studentIds: string[]) {
  const [students, setStudents] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || studentIds.length === 0) {
      setStudents([])
      setLoading(false)
      return
    }
    // Firestore 'in' queries support max 30 items
    const q = query(collection(db, 'users'), where('__name__', 'in', studentIds.slice(0, 30)))
    const unsubscribe = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => toUser(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [studentIds.join(',')])

  return { students, loading }
}
```

- [ ] **Step 3: Implement useAttendance hook**

Write `src/hooks/useAttendance.ts`:

```ts
import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'
import type { AttendanceRecord } from '../types'

function toRecord(id: string, data: any): AttendanceRecord {
  return { id, ...data, date: data.date?.toDate() || new Date(), createdAt: data.createdAt?.toDate() || new Date() }
}

export function useBatchAttendance(batchId: string | undefined, dateStr?: string) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !batchId) return
    const constraints = [where('batchId', '==', batchId), orderBy('date', 'desc'), limit(100)]
    const q = query(collection(db, 'attendance'), ...constraints)
    const unsubscribe = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => toRecord(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [batchId, dateStr])

  return { records, loading }
}

export function useStudentAttendance(studentId: string | undefined) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !studentId) return
    const q = query(
      collection(db, 'attendance'),
      where('studentId', '==', studentId),
      orderBy('date', 'desc'),
      limit(50)
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => toRecord(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [studentId])

  return { records, loading }
}
```

- [ ] **Step 4: Implement useSubscriptions hook**

Write `src/hooks/useSubscriptions.ts`:

```ts
import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import type { Subscription } from '../types'

function toSub(id: string, data: any): Subscription {
  return { id, ...data, assignedAt: data.assignedAt?.toDate() || new Date() }
}

export function useActiveSubscription(studentId: string | undefined) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !studentId) return
    const q = query(
      collection(db, 'subscriptions'),
      where('studentId', '==', studentId),
      where('isActive', '==', true),
      orderBy('assignedAt', 'asc')
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      // FIFO: oldest active subscription first
      const subs = snap.docs.map((d) => toSub(d.id, d.data()))
      setSubscription(subs[0] || null)
      setLoading(false)
    })
    return unsubscribe
  }, [studentId])

  return { subscription, loading }
}

export function useStudentSubscriptions(studentId: string | undefined) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !studentId) return
    const q = query(
      collection(db, 'subscriptions'),
      where('studentId', '==', studentId),
      orderBy('assignedAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setSubscriptions(snap.docs.map((d) => toSub(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [studentId])

  return { subscriptions, loading }
}

export function useLowBalanceStudents() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) return
    const q = query(
      collection(db, 'subscriptions'),
      where('isActive', '==', true),
      where('classesRemaining', '<=', 2)
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setSubscriptions(snap.docs.map((d) => toSub(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return { subscriptions, loading }
}
```

- [ ] **Step 5: Implement useVideos hook**

Write `src/hooks/useVideos.ts`:

```ts
import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'
import type { Video, DanceStyle } from '../types'

function toVideo(id: string, data: any): Video {
  return { id, ...data, uploadedAt: data.uploadedAt?.toDate() || new Date() }
}

export function useVideos(style?: DanceStyle, maxResults = 50) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) return
    const constraints = style
      ? [where('style', '==', style), orderBy('uploadedAt', 'desc'), limit(maxResults)]
      : [orderBy('uploadedAt', 'desc'), limit(maxResults)]
    const q = query(collection(db, 'videos'), ...constraints)
    const unsubscribe = onSnapshot(q, (snap) => {
      setVideos(snap.docs.map((d) => toVideo(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [style, maxResults])

  return { videos, loading }
}

export function useBatchVideos(batchIds: string[], style?: DanceStyle) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || batchIds.length === 0) {
      setVideos([])
      setLoading(false)
      return
    }
    const constraints = [
      where('batchIds', 'array-contains-any', batchIds.slice(0, 10)),
      orderBy('uploadedAt', 'desc'),
      limit(50),
    ]
    const q = query(collection(db, 'videos'), ...constraints)
    const unsubscribe = onSnapshot(q, (snap) => {
      let vids = snap.docs.map((d) => toVideo(d.id, d.data()))
      if (style) vids = vids.filter((v) => v.style === style)
      setVideos(vids)
      setLoading(false)
    })
    return unsubscribe
  }, [batchIds.join(','), style])

  return { videos, loading }
}
```

- [ ] **Step 6: Verify build succeeds**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/
git commit -m "feat: add Firestore hooks for batches, students, attendance, subscriptions, and videos"
```

---

## Task 6: Shared UI Components

**Files:**
- Create: `src/components/SubscriptionBadge.tsx`, `src/components/BatchCard.tsx`, `src/components/VideoCard.tsx`
- Create: `tests/components/SubscriptionBadge.test.tsx`

- [ ] **Step 1: Write failing test for SubscriptionBadge**

Write `tests/components/SubscriptionBadge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SubscriptionBadge } from '../../src/components/SubscriptionBadge'

describe('SubscriptionBadge', () => {
  it('shows red badge for 1 class left', () => {
    render(<SubscriptionBadge classesRemaining={1} />)
    expect(screen.getByText('1 class left')).toBeInTheDocument()
  })

  it('shows green badge for 10 classes', () => {
    render(<SubscriptionBadge classesRemaining={10} />)
    expect(screen.getByText('10 classes left')).toBeInTheDocument()
  })

  it('shows no classes message for 0', () => {
    render(<SubscriptionBadge classesRemaining={0} />)
    expect(screen.getByText('No classes left')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/components/SubscriptionBadge.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement SubscriptionBadge**

Write `src/components/SubscriptionBadge.tsx`:

```tsx
import { getBalanceColor, getBalanceLabel } from '../utils/subscriptions'

const colorClasses = {
  red: 'bg-[#E91E8C]/20 text-[#E91E8C]',
  orange: 'bg-[#FF6F00]/20 text-[#FF6F00]',
  green: 'bg-emerald-500/20 text-emerald-400',
}

interface Props {
  classesRemaining: number
}

export function SubscriptionBadge({ classesRemaining }: Props) {
  const color = getBalanceColor(classesRemaining)
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colorClasses[color]}`}>
      {getBalanceLabel(classesRemaining)}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/components/SubscriptionBadge.test.tsx
```

Expected: PASS

- [ ] **Step 5: Implement BatchCard**

Write `src/components/BatchCard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import type { Batch } from '../types'

const styleBorderColors: Record<string, string> = {
  Bollywood: 'border-l-[#FF6F00]',
  Western: 'border-l-[#00BCD4]',
  Fusion: 'border-l-[#7B2D8B]',
}

interface Props {
  batch: Batch
  showMarkButton?: boolean
}

export function BatchCard({ batch, showMarkButton }: Props) {
  return (
    <div className={`bg-white/5 rounded-xl p-3.5 border-l-[3px] ${styleBorderColors[batch.style] || 'border-l-white/20'}`}>
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm font-medium">{batch.name}</div>
          <div className="text-xs text-white/50 mt-0.5">
            {batch.time} · {batch.studentIds.length} students
          </div>
        </div>
        {showMarkButton && (
          <Link
            to={`/teacher/batches/${batch.id}/attendance`}
            className="bg-[#FF6F00] text-white text-xs px-3 py-1 rounded-full font-medium"
          >
            Mark
          </Link>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Implement VideoCard**

Write `src/components/VideoCard.tsx`:

```tsx
import type { Video } from '../types'
import { formatDateDDMMYYYY } from '../utils/dates'

const styleColors: Record<string, string> = {
  Bollywood: 'bg-[#FF6F00]/20 text-[#FF6F00]',
  Western: 'bg-[#00BCD4]/20 text-[#00BCD4]',
  Fusion: 'bg-[#7B2D8B]/20 text-[#7B2D8B]',
}

interface Props {
  video: Video
  onPlay?: (video: Video) => void
}

export function VideoCard({ video, onPlay }: Props) {
  return (
    <div
      className="bg-white/5 rounded-xl p-3 flex gap-3 items-center cursor-pointer active:bg-white/10"
      onClick={() => onPlay?.(video)}
    >
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#7B2D8B] to-[#E91E8C] flex items-center justify-center text-xl flex-shrink-0">
        ▶
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{video.title}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${styleColors[video.style]}`}>
            {video.style}
          </span>
          <span className="text-[10px] text-white/40">{formatDateDDMMYYYY(video.uploadedAt)}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/ tests/components/
git commit -m "feat: add SubscriptionBadge, BatchCard, and VideoCard components"
```

---

## Task 7: Teacher Pages — Dashboard, Batches, Attendance

**Files:**
- Modify: `src/pages/teacher/TeacherDashboard.tsx`, `src/pages/teacher/BatchList.tsx`, `src/pages/teacher/BatchDetail.tsx`, `src/pages/teacher/MarkAttendance.tsx`
- Create: `tests/pages/teacher/MarkAttendance.test.tsx`

- [ ] **Step 1: Implement TeacherDashboard**

Replace `src/pages/teacher/TeacherDashboard.tsx`:

```tsx
import { useAuth } from '../../hooks/useAuth'
import { useBatches } from '../../hooks/useBatches'
import { useStudent } from '../../hooks/useStudents'
import { useLowBalanceStudents } from '../../hooks/useSubscriptions'
import { useVideos } from '../../hooks/useVideos'
import { BatchCard } from '../../components/BatchCard'
import { VideoCard } from '../../components/VideoCard'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'
import { getGreeting, getCurrentDayAEST, getAESTDate } from '../../utils/dates'

export function TeacherDashboard() {
  const { user } = useAuth()
  const { student: teacherDoc } = useStudent(user?.uid)
  const { batches } = useBatches()
  const { subscriptions: lowBalanceSubs } = useLowBalanceStudents()
  const { videos } = useVideos(undefined, 3)

  const currentDay = getCurrentDayAEST()
  const todayBatches = batches.filter((b) => b.dayOfWeek === currentDay)
  const hour = getAESTDate(new Date()).getHours()
  const greeting = getGreeting(hour)

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-white/50">{greeting},</div>
        <div className="text-2xl font-semibold mt-0.5">{teacherDoc?.name || 'Teacher'}</div>
      </div>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Today's Batches</div>
        {todayBatches.length === 0 ? (
          <p className="text-white/30 text-sm">No batches today</p>
        ) : (
          <div className="space-y-2">
            {todayBatches.map((batch) => (
              <BatchCard key={batch.id} batch={batch} showMarkButton />
            ))}
          </div>
        )}
      </section>

      {lowBalanceSubs.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#E91E8C] mb-3">Low Balance Alerts</div>
          <div className="space-y-2">
            {lowBalanceSubs.map((sub) => (
              <div key={sub.id} className="bg-[#E91E8C]/10 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm">{sub.studentName}</span>
                <SubscriptionBadge classesRemaining={sub.classesRemaining} />
              </div>
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Recent Uploads</div>
          <div className="space-y-2">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement BatchList**

Replace `src/pages/teacher/BatchList.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useBatches } from '../../hooks/useBatches'
import { BatchCard } from '../../components/BatchCard'
import type { DanceStyle, BatchLevel } from '../../types'

export function BatchList() {
  const { batches, loading } = useBatches(false)
  const [showForm, setShowForm] = useState(false)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Batches</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#FF6F00] text-white text-xs px-3 py-1.5 rounded-full font-medium"
        >
          {showForm ? 'Cancel' : '+ New Batch'}
        </button>
      </div>

      {showForm && <CreateBatchForm onCreated={() => setShowForm(false)} />}

      <div className="space-y-2">
        {batches.map((batch) => (
          <Link key={batch.id} to={`/teacher/batches/${batch.id}`}>
            <BatchCard batch={batch} />
          </Link>
        ))}
      </div>
    </div>
  )
}

function CreateBatchForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('Monday')
  const [time, setTime] = useState('')
  const [style, setStyle] = useState<DanceStyle>('Bollywood')
  const [level, setLevel] = useState<BatchLevel>('Beginner')
  const [saving, setSaving] = useState(false)

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!db) return
    setSaving(true)
    await addDoc(collection(db, 'batches'), {
      name, dayOfWeek, time, style, level,
      studentIds: [], isActive: true, createdAt: serverTimestamp(),
    })
    setSaving(false)
    onCreated()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 rounded-xl p-4 space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Batch name" required
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
      <div className="grid grid-cols-2 gap-3">
        <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00BCD4]">
          {days.map((d) => <option key={d} value={d} className="bg-[#1A1A2E]">{d}</option>)}
        </select>
        <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 6:00 PM" required
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select value={style} onChange={(e) => setStyle(e.target.value as DanceStyle)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00BCD4]">
          <option value="Bollywood" className="bg-[#1A1A2E]">Bollywood</option>
          <option value="Western" className="bg-[#1A1A2E]">Western</option>
          <option value="Fusion" className="bg-[#1A1A2E]">Fusion</option>
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value as BatchLevel)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00BCD4]">
          <option value="Beginner" className="bg-[#1A1A2E]">Beginner</option>
          <option value="Intermediate" className="bg-[#1A1A2E]">Intermediate</option>
          <option value="Advanced" className="bg-[#1A1A2E]">Advanced</option>
        </select>
      </div>
      <button type="submit" disabled={saving}
        className="w-full bg-[#00BCD4] text-white font-medium rounded-lg py-2 text-sm disabled:opacity-50">
        {saving ? 'Creating...' : 'Create Batch'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Implement BatchDetail**

Replace `src/pages/teacher/BatchDetail.tsx`:

```tsx
import { useParams, Link } from 'react-router-dom'
import { useBatch } from '../../hooks/useBatches'
import { useBatchStudents } from '../../hooks/useStudents'
import { useBatchAttendance } from '../../hooks/useAttendance'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { formatDateDDMMYYYY } from '../../utils/dates'

export function BatchDetail() {
  const { batchId } = useParams()
  const { batch, loading } = useBatch(batchId)
  const { students } = useBatchStudents(batch?.studentIds || [])
  const { records } = useBatchAttendance(batchId)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!batch) return <div className="text-white/30 text-sm">Batch not found</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{batch.name}</h2>
        <div className="text-sm text-white/50 mt-1">{batch.dayOfWeek} · {batch.time} · {batch.style} · {batch.level}</div>
      </div>

      <Link
        to={`/teacher/batches/${batch.id}/attendance`}
        className="block w-full bg-[#FF6F00] text-white text-center font-medium rounded-xl py-3 text-sm"
      >
        Mark Attendance
      </Link>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">
          Students ({students.length})
        </div>
        <div className="space-y-2">
          {students.map((student) => (
            <StudentRow key={student.id} studentId={student.id} name={student.name} />
          ))}
        </div>
      </section>

      {records.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#7B2D8B] mb-3">Recent Attendance</div>
          <div className="space-y-1.5">
            {records.slice(0, 10).map((r) => (
              <div key={r.id} className="bg-white/5 rounded-lg p-2.5 flex justify-between items-center text-sm">
                <div>
                  <span>{r.studentName}</span>
                  <span className="text-white/40 ml-2 text-xs">{formatDateDDMMYYYY(r.date)}</span>
                </div>
                <span className={r.status === 'present' ? 'text-emerald-400' : 'text-red-400'}>
                  {r.status === 'present' ? 'Present ✓' : 'Absent ✗'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StudentRow({ studentId, name }: { studentId: string; name: string }) {
  const { subscription } = useActiveSubscription(studentId)
  return (
    <Link to={`/teacher/students/${studentId}`} className="bg-white/5 rounded-lg p-3 flex justify-between items-center block">
      <span className="text-sm">{name}</span>
      {subscription && <SubscriptionBadge classesRemaining={subscription.classesRemaining} />}
    </Link>
  )
}
```

- [ ] **Step 4: Implement MarkAttendance**

Replace `src/pages/teacher/MarkAttendance.tsx`:

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useBatch } from '../../hooks/useBatches'
import { useBatchStudents } from '../../hooks/useStudents'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'

export function MarkAttendance() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { batch, loading } = useBatch(batchId)
  const { students } = useBatchStudents(batch?.studentIds || [])
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({})
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!batch) return <div className="text-white/30 text-sm">Batch not found</div>

  function toggle(studentId: string) {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }))
  }

  async function handleSubmit() {
    if (!db || !user || !batch) return
    setSubmitting(true)

    const batch_write = writeBatch(db)
    const now = new Date()

    for (const student of students) {
      const status = attendance[student.id] || 'absent'
      const ref = doc(collection(db, 'attendance'))
      batch_write.set(ref, {
        batchId: batch.id,
        studentId: student.id,
        studentName: student.name,
        batchName: batch.name,
        date: now,
        status,
        markedBy: user.uid,
        createdAt: serverTimestamp(),
      })
    }

    await batch_write.commit()
    setSubmitting(false)
    navigate(`/teacher/batches/${batch.id}`)
  }

  const markedCount = Object.values(attendance).filter((s) => s === 'present').length

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{batch.name}</h2>
        <div className="text-sm text-white/50">Mark attendance · {markedCount} present</div>
      </div>

      <div className="space-y-2">
        {students.map((student) => (
          <StudentAttendanceRow
            key={student.id}
            studentId={student.id}
            name={student.name}
            status={attendance[student.id] || 'absent'}
            onToggle={() => toggle(student.id)}
          />
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Attendance'}
      </button>
    </div>
  )
}

function StudentAttendanceRow({
  studentId, name, status, onToggle,
}: {
  studentId: string; name: string; status: 'present' | 'absent'; onToggle: () => void
}) {
  const { subscription } = useActiveSubscription(studentId)
  const noClasses = subscription && subscription.classesRemaining === 0
  const isPresent = status === 'present'

  return (
    <div
      onClick={noClasses ? undefined : onToggle}
      className={`rounded-xl p-3.5 flex justify-between items-center cursor-pointer transition-colors ${
        isPresent ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-white/5 border border-transparent'
      } ${noClasses ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div>
        <div className="text-sm font-medium">{name}</div>
        {noClasses && <div className="text-[10px] text-[#E91E8C] mt-0.5">No classes remaining</div>}
      </div>
      <div className="flex items-center gap-2">
        {subscription && <SubscriptionBadge classesRemaining={subscription.classesRemaining} />}
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${
          isPresent ? 'border-emerald-400 bg-emerald-400 text-white' : 'border-white/20'
        }`}>
          {isPresent && '✓'}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify build succeeds**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/pages/teacher/
git commit -m "feat: add teacher dashboard, batch list, batch detail, and mark attendance pages"
```

---

## Task 8: Teacher Pages — Students, Subscriptions, Videos

**Files:**
- Modify: `src/pages/teacher/StudentList.tsx`, `src/pages/teacher/StudentProfile.tsx`, `src/pages/teacher/AssignSubscription.tsx`, `src/pages/teacher/VideoList.tsx`, `src/pages/teacher/VideoUpload.tsx`

- [ ] **Step 1: Implement StudentList**

Replace `src/pages/teacher/StudentList.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { getFunctions } from 'firebase/functions'
import { useStudents } from '../../hooks/useStudents'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'

export function StudentList() {
  const { students, loading } = useStudents()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Students</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#FF6F00] text-white text-xs px-3 py-1.5 rounded-full font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Student'}
        </button>
      </div>

      {showForm && <AddStudentForm onCreated={() => setShowForm(false)} />}

      <input
        type="text"
        placeholder="Search students..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]"
      />

      <div className="space-y-2">
        {filtered.map((student) => (
          <StudentRow key={student.id} student={student} />
        ))}
        {filtered.length === 0 && <p className="text-white/30 text-sm">No students found</p>}
      </div>
    </div>
  )
}

function StudentRow({ student }: { student: { id: string; name: string; email: string } }) {
  const { subscription } = useActiveSubscription(student.id)
  return (
    <Link to={`/teacher/students/${student.id}`} className="bg-white/5 rounded-xl p-3.5 flex justify-between items-center block">
      <div>
        <div className="text-sm font-medium">{student.name}</div>
        <div className="text-xs text-white/40 mt-0.5">{student.email}</div>
      </div>
      {subscription && <SubscriptionBadge classesRemaining={subscription.classesRemaining} />}
    </Link>
  )
}

function AddStudentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const functions = getFunctions()
      const createStudent = httpsCallable(functions, 'createStudent')
      await createStudent({ name, email, phone })
      setSaving(false)
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create student')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 rounded-xl p-4 space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
      {error && <p className="text-[#E91E8C] text-xs">{error}</p>}
      <button type="submit" disabled={saving}
        className="w-full bg-[#00BCD4] text-white font-medium rounded-lg py-2 text-sm disabled:opacity-50">
        {saving ? 'Creating...' : 'Create & Send Invite'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Implement StudentProfile**

Replace `src/pages/teacher/StudentProfile.tsx`:

```tsx
import { useParams, Link } from 'react-router-dom'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { useStudent } from '../../hooks/useStudents'
import { useStudentSubscriptions } from '../../hooks/useSubscriptions'
import { useStudentAttendance } from '../../hooks/useAttendance'
import { useBatches } from '../../hooks/useBatches'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'
import { formatDateDDMMYYYY } from '../../utils/dates'
import { useState } from 'react'

export function StudentProfile() {
  const { studentId } = useParams()
  const { student, loading } = useStudent(studentId)
  const { subscriptions } = useStudentSubscriptions(studentId)
  const { records } = useStudentAttendance(studentId)
  const { batches: allBatches } = useBatches()
  const [addingBatch, setAddingBatch] = useState(false)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!student) return <div className="text-white/30 text-sm">Student not found</div>

  const availableBatches = allBatches.filter((b) => !student.batchIds.includes(b.id))
  const activeSub = subscriptions.find((s) => s.isActive)

  async function addToBatch(batchId: string) {
    if (!db || !studentId) return
    // Batched write for bidirectional sync
    const { writeBatch: createBatch } = await import('firebase/firestore')
    const batch = createBatch(db)
    batch.update(doc(db, 'users', studentId), { batchIds: arrayUnion(batchId) })
    batch.update(doc(db, 'batches', batchId), { studentIds: arrayUnion(studentId) })
    await batch.commit()
    setAddingBatch(false)
  }

  async function removeFromBatch(batchId: string) {
    if (!db || !studentId) return
    const { writeBatch: createBatch } = await import('firebase/firestore')
    const batch = createBatch(db)
    batch.update(doc(db, 'users', studentId), { batchIds: arrayRemove(batchId) })
    batch.update(doc(db, 'batches', batchId), { studentIds: arrayRemove(studentId) })
    await batch.commit()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{student.name}</h2>
        <div className="text-sm text-white/50">{student.email}</div>
        {student.phone && <div className="text-sm text-white/50">{student.phone}</div>}
      </div>

      <div className="flex gap-3">
        <Link to={`/teacher/students/${studentId}/subscribe`}
          className="flex-1 bg-[#FF6F00] text-white text-center font-medium rounded-xl py-2.5 text-sm">
          Assign Pack
        </Link>
        <button onClick={() => setAddingBatch(!addingBatch)}
          className="flex-1 bg-[#7B2D8B] text-white font-medium rounded-xl py-2.5 text-sm">
          {addingBatch ? 'Cancel' : 'Add to Batch'}
        </button>
      </div>

      {addingBatch && availableBatches.length > 0 && (
        <div className="bg-white/5 rounded-xl p-3 space-y-2">
          {availableBatches.map((b) => (
            <button key={b.id} onClick={() => addToBatch(b.id)}
              className="w-full bg-white/5 rounded-lg p-2.5 text-left text-sm hover:bg-white/10">
              {b.name}
            </button>
          ))}
        </div>
      )}

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Subscription</div>
        {activeSub ? (
          <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
            <div>
              <div className="text-sm">{activeSub.packSize}-class pack</div>
              <div className="text-xs text-white/40 mt-0.5">Assigned {formatDateDDMMYYYY(activeSub.assignedAt)}</div>
            </div>
            <SubscriptionBadge classesRemaining={activeSub.classesRemaining} />
          </div>
        ) : (
          <p className="text-white/30 text-sm">No active subscription</p>
        )}
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">
          Batches ({student.batchIds.length})
        </div>
        <div className="space-y-2">
          {allBatches.filter((b) => student.batchIds.includes(b.id)).map((b) => (
            <div key={b.id} className="bg-white/5 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm">{b.name}</span>
              <button onClick={() => removeFromBatch(b.id)} className="text-xs text-[#E91E8C]">Remove</button>
            </div>
          ))}
        </div>
      </section>

      {records.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#7B2D8B] mb-3">Attendance History</div>
          <div className="space-y-1.5">
            {records.slice(0, 20).map((r) => (
              <div key={r.id} className="bg-white/5 rounded-lg p-2.5 flex justify-between items-center text-sm">
                <div>
                  <span>{r.batchName}</span>
                  <span className="text-white/40 ml-2 text-xs">{formatDateDDMMYYYY(r.date)}</span>
                </div>
                <span className={r.status === 'present' ? 'text-emerald-400' : 'text-red-400'}>
                  {r.status === 'present' ? 'Present ✓' : 'Absent ✗'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement AssignSubscription**

Replace `src/pages/teacher/AssignSubscription.tsx`:

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import type { PackSize } from '../../types'

const packs: { size: PackSize; label: string }[] = [
  { size: 5, label: '5 Classes' },
  { size: 10, label: '10 Classes' },
  { size: 20, label: '20 Classes' },
]

export function AssignSubscription() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { student, loading } = useStudent(studentId)
  const [selected, setSelected] = useState<PackSize | null>(null)
  const [saving, setSaving] = useState(false)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>
  if (!student) return <div className="text-white/30 text-sm">Student not found</div>

  async function handleAssign() {
    if (!db || !user || !selected || !studentId) return
    setSaving(true)
    await addDoc(collection(db, 'subscriptions'), {
      studentId,
      studentName: student!.name,
      packSize: selected,
      classesRemaining: selected,
      assignedBy: user.uid,
      assignedAt: serverTimestamp(),
      isActive: true,
    })
    setSaving(false)
    navigate(`/teacher/students/${studentId}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Assign Pack</h2>
        <div className="text-sm text-white/50 mt-1">{student.name}</div>
      </div>

      <div className="space-y-3">
        {packs.map((pack) => (
          <button
            key={pack.size}
            onClick={() => setSelected(pack.size)}
            className={`w-full rounded-xl p-4 text-left transition-colors ${
              selected === pack.size
                ? 'bg-[#00BCD4]/20 border-2 border-[#00BCD4]'
                : 'bg-white/5 border-2 border-transparent'
            }`}
          >
            <div className="text-lg font-semibold">{pack.label}</div>
            <div className="text-xs text-white/40 mt-1">{pack.size}-class pass</div>
          </button>
        ))}
      </div>

      <button
        onClick={handleAssign}
        disabled={!selected || saving}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50"
      >
        {saving ? 'Assigning...' : 'Assign Pack'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Implement VideoList**

Replace `src/pages/teacher/VideoList.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVideos } from '../../hooks/useVideos'
import { VideoCard } from '../../components/VideoCard'
import type { DanceStyle } from '../../types'

const filters: (DanceStyle | 'All')[] = ['All', 'Bollywood', 'Western', 'Fusion']

export function VideoList() {
  const [activeFilter, setActiveFilter] = useState<DanceStyle | 'All'>('All')
  const { videos, loading } = useVideos(activeFilter === 'All' ? undefined : activeFilter)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Videos</h2>
        <Link to="/teacher/videos/upload"
          className="bg-[#FF6F00] text-white text-xs px-3 py-1.5 rounded-full font-medium">
          + Upload
        </Link>
      </div>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              activeFilter === f ? 'bg-[#00BCD4] text-white' : 'bg-white/5 text-white/50'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {playingUrl && (
        <div className="rounded-xl overflow-hidden bg-black">
          <video src={playingUrl} controls autoPlay className="w-full max-h-64" />
          <button onClick={() => setPlayingUrl(null)} className="w-full py-2 text-xs text-white/50">Close</button>
        </div>
      )}

      {loading ? (
        <div className="text-white/30 text-sm">Loading...</div>
      ) : (
        <div className="space-y-2">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} onPlay={(v) => setPlayingUrl(v.storageUrl)} />
          ))}
          {videos.length === 0 && <p className="text-white/30 text-sm">No videos yet</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Implement VideoUpload**

Replace `src/pages/teacher/VideoUpload.tsx`:

```tsx
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, storage } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useBatches } from '../../hooks/useBatches'
import type { DanceStyle } from '../../types'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

export function VideoUpload() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { batches } = useBatches()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState<DanceStyle>('Bollywood')
  const [selectedBatches, setSelectedBatches] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Please select an MP4, MOV, or WebM file')
      return
    }
    if (f.size > MAX_FILE_SIZE) {
      setError('File size must be under 500MB')
      return
    }
    setFile(f)
    setError('')
  }

  function toggleBatch(batchId: string) {
    setSelectedBatches((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    )
  }

  async function handleUpload() {
    if (!db || !storage || !user || !file) return
    setUploading(true)
    setError('')

    try {
      const storageRef = ref(storage, `videos/${Date.now()}-${file.name}`)
      const task = uploadBytesResumable(storageRef, file)

      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve()
        )
      })

      const storageUrl = await getDownloadURL(storageRef)

      await addDoc(collection(db, 'videos'), {
        title, description, style,
        batchIds: selectedBatches,
        storageUrl,
        thumbnailUrl: '',
        uploadedBy: user.uid,
        uploadedAt: serverTimestamp(),
      })

      navigate('/teacher/videos')
    } catch (err: any) {
      setError(err.message || 'Upload failed — try again')
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Upload Video</h2>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" required
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />

      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4] resize-none" />

      <select value={style} onChange={(e) => setStyle(e.target.value as DanceStyle)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00BCD4]">
        <option value="Bollywood" className="bg-[#1A1A2E]">Bollywood</option>
        <option value="Western" className="bg-[#1A1A2E]">Western</option>
        <option value="Fusion" className="bg-[#1A1A2E]">Fusion</option>
      </select>

      <div>
        <div className="text-xs text-white/50 mb-2">Visible to batches:</div>
        <div className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <button key={b.id} onClick={() => toggleBatch(b.id)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                selectedBatches.includes(b.id) ? 'bg-[#00BCD4] text-white' : 'bg-white/5 text-white/50'
              }`}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm"
          onChange={handleFileSelect} className="hidden" />
        <button onClick={() => fileRef.current?.click()}
          className="w-full bg-white/5 border-2 border-dashed border-white/20 rounded-xl py-8 text-center text-sm text-white/50">
          {file ? file.name : 'Tap to select video (MP4, MOV, WebM — max 500MB)'}
        </button>
      </div>

      {uploading && (
        <div className="w-full bg-white/10 rounded-full h-2">
          <div className="bg-[#00BCD4] h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="text-[#E91E8C] text-sm">{error}</p>}

      <button onClick={handleUpload} disabled={!file || !title || uploading}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50">
        {uploading ? `Uploading ${progress}%...` : 'Upload Video'}
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Verify build succeeds**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/pages/teacher/
git commit -m "feat: add student management, subscription assignment, and video upload pages"
```

---

## Task 9: Student Pages

**Files:**
- Modify: `src/pages/student/StudentHome.tsx`, `src/pages/student/AttendanceHistory.tsx`, `src/pages/student/VideoLibrary.tsx`, `src/pages/student/StudentProfilePage.tsx`

- [ ] **Step 1: Implement StudentHome**

Replace `src/pages/student/StudentHome.tsx`:

```tsx
import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { useStudentBatches } from '../../hooks/useBatches'
import { getGreeting, getAESTDate, getCurrentDayAEST } from '../../utils/dates'

export function StudentHome() {
  const { user } = useAuth()
  const { student } = useStudent(user?.uid)
  const { subscription } = useActiveSubscription(user?.uid)
  const { batches } = useStudentBatches(student?.batchIds || [])

  const hour = getAESTDate(new Date()).getHours()
  const greeting = getGreeting(hour)
  const currentDay = getCurrentDayAEST()

  // Find next upcoming batch (today or next occurrence)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayIndex = days.indexOf(currentDay)
  const sortedBatches = [...batches].sort((a, b) => {
    const aIdx = (days.indexOf(a.dayOfWeek) - todayIndex + 7) % 7
    const bIdx = (days.indexOf(b.dayOfWeek) - todayIndex + 7) % 7
    return aIdx - bIdx
  })
  const nextBatch = sortedBatches[0]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-sm text-white/50">{greeting},</div>
        <div className="text-2xl font-semibold mt-0.5">{student?.name || 'Student'}</div>
      </div>

      <div className="bg-gradient-to-br from-[#00BCD4]/20 to-[#7B2D8B]/20 rounded-2xl p-6 text-center">
        <div className="text-xs uppercase tracking-wider text-white/50">Classes Remaining</div>
        <div className="text-5xl font-bold text-[#00BCD4] mt-2">
          {subscription?.classesRemaining ?? 0}
        </div>
        {subscription && (
          <div className="text-xs text-white/40 mt-2">
            {subscription.packSize}-class {batches[0]?.style || ''} pack
          </div>
        )}
        {!subscription && (
          <div className="text-xs text-[#E91E8C] mt-2">No active subscription</div>
        )}
      </div>

      {nextBatch && (
        <section>
          <div className="text-xs uppercase tracking-wider text-[#FF6F00] mb-3">Next Class</div>
          <div className="bg-white/5 rounded-xl p-3.5 border-l-[3px] border-l-[#FF6F00]">
            <div className="text-sm font-medium">{nextBatch.name}</div>
            <div className="text-xs text-white/50 mt-0.5">{nextBatch.dayOfWeek} · {nextBatch.time}</div>
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement AttendanceHistory**

Replace `src/pages/student/AttendanceHistory.tsx`:

```tsx
import { useAuth } from '../../hooks/useAuth'
import { useStudentAttendance } from '../../hooks/useAttendance'
import { formatDateDDMMYYYY } from '../../utils/dates'

export function AttendanceHistory() {
  const { user } = useAuth()
  const { records, loading } = useStudentAttendance(user?.uid)

  if (loading) return <div className="text-white/30 text-sm">Loading...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Attendance History</h2>

      {records.length === 0 ? (
        <p className="text-white/30 text-sm">No attendance records yet</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="bg-white/5 rounded-xl p-3.5 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{r.batchName}</div>
                <div className="text-xs text-white/40 mt-0.5">{formatDateDDMMYYYY(r.date)}</div>
              </div>
              <span className={r.status === 'present' ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm'}>
                {r.status === 'present' ? 'Present ✓' : 'Absent ✗'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement VideoLibrary**

Replace `src/pages/student/VideoLibrary.tsx`:

```tsx
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import { useBatchVideos } from '../../hooks/useVideos'
import { VideoCard } from '../../components/VideoCard'
import type { DanceStyle } from '../../types'

const filters: (DanceStyle | 'All')[] = ['All', 'Bollywood', 'Western', 'Fusion']

export function VideoLibrary() {
  const { user } = useAuth()
  const { student } = useStudent(user?.uid)
  const [activeFilter, setActiveFilter] = useState<DanceStyle | 'All'>('All')
  const { videos, loading } = useBatchVideos(
    student?.batchIds || [],
    activeFilter === 'All' ? undefined : activeFilter
  )
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Videos</h2>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              activeFilter === f ? 'bg-[#00BCD4] text-white' : 'bg-white/5 text-white/50'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {playingUrl && (
        <div className="rounded-xl overflow-hidden bg-black">
          <video src={playingUrl} controls autoPlay className="w-full max-h-64" />
          <button onClick={() => setPlayingUrl(null)} className="w-full py-2 text-xs text-white/50">Close</button>
        </div>
      )}

      {loading ? (
        <div className="text-white/30 text-sm">Loading...</div>
      ) : (
        <div className="space-y-2">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} onPlay={(v) => setPlayingUrl(v.storageUrl)} />
          ))}
          {videos.length === 0 && <p className="text-white/30 text-sm">No videos available</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implement StudentProfilePage**

Replace `src/pages/student/StudentProfilePage.tsx`:

```tsx
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useStudent } from '../../hooks/useStudents'
import { useActiveSubscription } from '../../hooks/useSubscriptions'
import { useStudentBatches } from '../../hooks/useBatches'
import { SubscriptionBadge } from '../../components/SubscriptionBadge'

export function StudentProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { student } = useStudent(user?.uid)
  const { subscription } = useActiveSubscription(user?.uid)
  const { batches } = useStudentBatches(student?.batchIds || [])

  async function handleSignOut() {
    if (!auth) return
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00BCD4] to-[#7B2D8B] flex items-center justify-center text-2xl font-bold mx-auto">
          {student?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="text-lg font-semibold mt-3">{student?.name}</div>
        <div className="text-sm text-white/50">{student?.email}</div>
        {student?.phone && <div className="text-sm text-white/50">{student.phone}</div>}
      </div>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Subscription</div>
        {subscription ? (
          <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm">{subscription.packSize}-class pack</span>
            <SubscriptionBadge classesRemaining={subscription.classesRemaining} />
          </div>
        ) : (
          <p className="text-white/30 text-sm">No active subscription</p>
        )}
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">My Batches</div>
        <div className="space-y-2">
          {batches.map((b) => (
            <div key={b.id} className="bg-white/5 rounded-xl p-3.5">
              <div className="text-sm font-medium">{b.name}</div>
              <div className="text-xs text-white/50 mt-0.5">{b.dayOfWeek} · {b.time}</div>
            </div>
          ))}
          {batches.length === 0 && <p className="text-white/30 text-sm">Not enrolled in any batches</p>}
        </div>
      </section>

      <button onClick={handleSignOut}
        className="w-full bg-white/5 border border-white/10 text-white/60 rounded-xl py-2.5 text-sm">
        Sign Out
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Verify build succeeds**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/pages/student/
git commit -m "feat: add student home, attendance history, video library, and profile pages"
```

---

## Task 10: Cloud Functions

**Files:**
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts`, `functions/src/createStudent.ts`, `functions/src/onAttendanceCreated.ts`, `functions/src/onVideoCreated.ts`

- [ ] **Step 1: Initialize functions directory**

```bash
cd "/Users/biswanathdutta/Documents/claude_code/fusion steps"
mkdir -p functions/src
```

- [ ] **Step 2: Create functions/package.json**

Write `functions/package.json`:

```json
{
  "name": "fusion-steps-functions",
  "private": true,
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  },
  "engines": { "node": "18" },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 3: Create functions/tsconfig.json**

Write `functions/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2018",
    "esModuleInterop": true
  },
  "compileOnSave": true,
  "include": ["src"]
}
```

- [ ] **Step 4: Implement createStudent Cloud Function**

Write `functions/src/createStudent.ts`:

```ts
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

export const createStudent = functions.https.onCall(async (data, context) => {
  // Only teachers can create students
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
  }

  const callerDoc = await admin.firestore().doc(`users/${context.auth.uid}`).get()
  if (callerDoc.data()?.role !== 'teacher') {
    throw new functions.https.HttpsError('permission-denied', 'Only teachers can create students')
  }

  const { name, email, phone } = data as { name: string; email: string; phone?: string }

  if (!name || !email) {
    throw new functions.https.HttpsError('invalid-argument', 'Name and email are required')
  }

  // Create Firebase Auth user
  const userRecord = await admin.auth().createUser({
    email,
    displayName: name,
  })

  // Create Firestore user doc
  await admin.firestore().doc(`users/${userRecord.uid}`).set({
    name,
    email,
    phone: phone || '',
    role: 'student',
    batchIds: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: context.auth.uid,
  })

  // Send password reset email as invite
  // generatePasswordResetLink returns a link but does NOT send an email.
  // Use the Firebase Auth REST API to send the reset email.
  const resetLink = await admin.auth().generatePasswordResetLink(email)

  // Use Firebase's built-in email sending via the Auth REST API
  const apiKey = process.env.FIREBASE_API_KEY || functions.config().app?.api_key
  if (apiKey) {
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    })
  }

  return { uid: userRecord.uid }
})
```

- [ ] **Step 5: Implement onAttendanceCreated Cloud Function**

Write `functions/src/onAttendanceCreated.ts`:

```ts
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

export const onAttendanceCreated = functions.firestore
  .document('attendance/{attendanceId}')
  .onCreate(async (snap) => {
    const data = snap.data()
    if (data.status !== 'present') return

    const db = admin.firestore()

    // Find oldest active subscription for this student (FIFO)
    const subsSnap = await db.collection('subscriptions')
      .where('studentId', '==', data.studentId)
      .where('isActive', '==', true)
      .orderBy('assignedAt', 'asc')
      .limit(1)
      .get()

    if (!subsSnap.empty) {
      const subDoc = subsSnap.docs[0]
      const subData = subDoc.data()
      const newRemaining = subData.classesRemaining - 1

      const updates: Record<string, any> = { classesRemaining: newRemaining }
      if (newRemaining <= 0) updates.isActive = false

      await subDoc.ref.update(updates)

      // Send low-balance notification if ≤ 2 classes remaining
      if (newRemaining > 0 && newRemaining <= 2) {
        await sendNotification(
          data.studentId,
          'Low Balance',
          `You have ${newRemaining} class${newRemaining === 1 ? '' : 'es'} left — talk to Sriparna to top up`
        )
      }
    }

    // Send attendance notification
    // Format date in AEST (DD/MM/YYYY)
    const date = data.date.toDate()
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    const dateStr = formatter.format(date)

    await sendNotification(
      data.studentId,
      'Attendance Marked',
      `Your attendance for ${data.batchName} on ${dateStr} has been marked — Fusion Steps`
    )
  })

async function sendNotification(userId: string, title: string, body: string) {
  const userDoc = await admin.firestore().doc(`users/${userId}`).get()
  const fcmToken = userDoc.data()?.fcmToken
  if (!fcmToken) return

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
    })
  } catch (err) {
    console.warn('FCM send failed:', err)
  }
}
```

- [ ] **Step 6: Implement onVideoCreated Cloud Function**

Write `functions/src/onVideoCreated.ts`:

```ts
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

export const onVideoCreated = functions.firestore
  .document('videos/{videoId}')
  .onCreate(async (snap) => {
    const data = snap.data()
    const batchIds: string[] = data.batchIds || []

    if (batchIds.length === 0) return

    const db = admin.firestore()

    // Collect all student IDs from tagged batches
    const studentIds = new Set<string>()
    for (const batchId of batchIds) {
      const batchDoc = await db.doc(`batches/${batchId}`).get()
      const batchData = batchDoc.data()
      if (batchData?.studentIds) {
        batchData.studentIds.forEach((id: string) => studentIds.add(id))
      }
    }

    // Send notification to each student
    const promises = Array.from(studentIds).map(async (studentId) => {
      const userDoc = await db.doc(`users/${studentId}`).get()
      const fcmToken = userDoc.data()?.fcmToken
      if (!fcmToken) return

      try {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: 'New Video',
            body: `New video: ${data.title} — watch now!`,
          },
        })
      } catch (err) {
        console.warn(`FCM send failed for ${studentId}:`, err)
      }
    })

    await Promise.all(promises)
  })
```

- [ ] **Step 7: Create functions entry point**

Write `functions/src/index.ts`:

```ts
import * as admin from 'firebase-admin'
admin.initializeApp()

export { createStudent } from './createStudent'
export { onAttendanceCreated } from './onAttendanceCreated'
export { onVideoCreated } from './onVideoCreated'
```

- [ ] **Step 8: Install function dependencies**

```bash
cd "/Users/biswanathdutta/Documents/claude_code/fusion steps/functions" && npm install
```

- [ ] **Step 9: Verify functions build**

```bash
cd "/Users/biswanathdutta/Documents/claude_code/fusion steps/functions" && npm run build
```

Expected: Build succeeds.

- [ ] **Step 10: Commit**

```bash
cd "/Users/biswanathdutta/Documents/claude_code/fusion steps"
git add functions/
git commit -m "feat: add Cloud Functions for student creation, attendance processing, and video notifications"
```

---

## Task 11: Firestore Security Rules + Firebase Config

**Files:**
- Create: `firestore.rules`, `firebase.json`
- Modify: `src/firebase.ts` (add FCM token storage)

- [ ] **Step 1: Write Firestore security rules**

Write `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isTeacher() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }

    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read: if isTeacher() || isOwner(userId);
      allow write: if isTeacher();
      // Allow students to update their own fcmToken
      allow update: if isOwner(userId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['fcmToken']);
    }

    match /batches/{batchId} {
      allow read: if isTeacher() ||
        (request.auth != null && resource.data.studentIds.hasAny([request.auth.uid]));
      allow write: if isTeacher();
    }

    match /attendance/{attendanceId} {
      allow read: if isTeacher() || (request.auth != null && resource.data.studentId == request.auth.uid);
      allow create: if isTeacher();
    }

    match /subscriptions/{subscriptionId} {
      allow read: if isTeacher() || (request.auth != null && resource.data.studentId == request.auth.uid);
      allow write: if isTeacher();
    }

    match /videos/{videoId} {
      allow read: if isTeacher() ||
        (request.auth != null &&
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.batchIds.hasAny(resource.data.batchIds));
      allow write: if isTeacher();
    }
  }
}
```

- [ ] **Step 2: Write firebase.json**

Write `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": {
    "source": "functions"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true }
  }
}
```

- [ ] **Step 3: Write storage rules**

Write `storage.rules`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /videos/{videoFile} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
  }
}
```

- [ ] **Step 4: Add FCM token storage to firebase.ts**

Add to `src/firebase.ts`:

```ts
import { getToken } from 'firebase/messaging'
import { doc, updateDoc } from 'firebase/firestore'

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
```

- [ ] **Step 5: Create FCM service worker**

Write `public/firebase-messaging-sw.js`:

```js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// These values are replaced at build time by vite.config.ts define option.
// See Task 1 Step 3 for the Vite config that injects these.
firebase.initializeApp({
  apiKey: '__VITE_FIREBASE_API_KEY__',
  projectId: '__VITE_FIREBASE_PROJECT_ID__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__VITE_FIREBASE_APP_ID__',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  if (title) {
    self.registration.showNotification(title, { body, icon: '/assets/icon-192x192.png' })
  }
})
```

- [ ] **Step 6: Add VITE_FIREBASE_VAPID_KEY to .env.example**

Append to `.env.example`:

```env
VITE_FIREBASE_VAPID_KEY=your-vapid-key
```

- [ ] **Step 7: Verify build**

```bash
cd "/Users/biswanathdutta/Documents/claude_code/fusion steps" && npm run build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add firestore.rules storage.rules firebase.json public/firebase-messaging-sw.js .env.example src/firebase.ts
git commit -m "feat: add Firestore/Storage security rules, Firebase config, and FCM service worker"
```

---

## Task 12: Final Polish + Run All Tests

**Files:**
- Modify: `src/main.tsx`
- Verify: full build + all tests

- [ ] **Step 1: Update main.tsx entry point**

Write `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 2: Update .gitignore**

Append to the existing `.gitignore`:

```
node_modules/
dist/
.env
.env.local
functions/lib/
functions/node_modules/
```

- [ ] **Step 3: Run all tests**

```bash
cd "/Users/biswanathdutta/Documents/claude_code/fusion steps" && npm test
```

Expected: All tests PASS

- [ ] **Step 4: Run full build**

```bash
npm run build
```

Expected: Build succeeds, `dist/` directory created with all assets.

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: Dev server starts, app loads at localhost showing setup screen (since no `.env` with Firebase config exists yet).

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: finalize Fusion Steps PWA — all pages, tests, and build passing"
```

---

## Summary

| Task | What it builds | Est. files |
|------|---------------|------------|
| 1 | Project scaffold, Firebase init, types, PWA manifest | 8 |
| 2 | Date + subscription utilities with tests | 4 |
| 3 | Auth context, protected routes, setup screen | 4 |
| 4 | Layouts, navigation, login page, placeholder pages | 18 |
| 5 | All Firestore hooks (batches, students, attendance, subscriptions, videos) | 6 |
| 6 | Shared UI components (SubscriptionBadge, BatchCard, VideoCard) | 4 |
| 7 | Teacher: dashboard, batch list, batch detail, mark attendance | 4 |
| 8 | Teacher: student list, student profile, assign subscription, video list/upload | 5 |
| 9 | Student: home, attendance history, video library, profile | 4 |
| 10 | Cloud Functions (createStudent, onAttendanceCreated, onVideoCreated) | 5 |
| 11 | Security rules, Firebase config, FCM service worker | 5 |
| 12 | Final polish, run all tests, verify build | 2 |
