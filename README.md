# Fusion Steps Dance Academy

<div align="center">

**A teacher-and-student PWA for the Fusion Steps Dance Academy in Sydney**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4.0-38BDF8)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-11.5-FFCA28)](https://firebase.google.com/)
[![Cloud Functions](https://img.shields.io/badge/Cloud%20Functions-Node%2020-339933)](https://firebase.google.com/docs/functions)
[![Tests](https://img.shields.io/badge/Tests-58%20unit%20%2B%207%20E2E-success)](#testing)

[Overview](#overview) • [Latest Updates](#latest-updates) • [Features](#features) • [Architecture](#architecture) • [Tech Stack](#tech-stack) • [Getting Started](#getting-started) • [Testing](#testing) • [Deployment](#deployment)

</div>

---

> **IMPORTANT NOTICE:** This repository and its contents are proprietary and confidential. All rights reserved. Unauthorized copying, distribution, modification, or any other use is strictly prohibited.

---

## Overview

Fusion Steps is a mobile-first PWA built for **Sriparna Dutta**, the sole teacher and operator of the Fusion Steps Dance Academy in Sydney, Australia. It replaces a manual paper-and-spreadsheet workflow for tracking attendance, class packs, and dance videos, and gives students a self-service view of their own balance and history.

The app has two role-gated experiences — **teacher** and **student** — under a shared Firebase backend, and is designed around the constraints of a single-operator business: offline tolerance, AEST timezone correctness, Australian dollar pricing, DD/MM/YYYY dates throughout, and zero-overhead operations (no separate ops console, no on-call).

### Key Highlights

- 🎯 **Two role-gated trees** — teachers manage batches, attendance, students, packs, and videos; students see their own attendance, balance, and library.
- 💳 **Server-only subscription deduction** — class-pack balances are decremented exclusively by Cloud Functions, never by the client, eliminating an entire class of double-deduct bugs.
- 📜 **Audited pack mutations** — every backdate, resize, and adjustment appends a typed `editHistory` entry, surfaced on the student profile so parent questions ("why does she only have 2 left?") have a clean answer.
- 🔕 **FCM-aware backdating** — backdated attendance still drives FIFO decrement but suppresses both the low-balance alert and the attendance receipt — past records aren't notifications.
- 📱 **Mobile-first PWA** — Vite PWA plugin, persistent IndexedDB cache, Firestore offline mode, Netlify hosting with SPA redirect, FCM background notifications.
- 🇦🇺 **AEST/AUD-native** — `formatDateDDMMYYYY`, `getAESTDate`, `getCurrentDayAEST` helpers used throughout; attendance dedupe uses AEST day bounds, not UTC.
- 🧪 **Three-tier test coverage** — 39 PWA unit/integration tests, 19 Cloud Functions tests with `firebase-admin` mocks, 7 Playwright end-to-end specs against the full Firebase emulator stack.
- 🚦 **Single-operator workflow** — every feature is filed as an exhaustive GitHub issue on [Project #7](https://github.com/users/biswan07/projects/7/views/1) before any code is written; brainstorming and implementation never share a context window.

---

## 🆕 Latest Updates

### April 2026

- ✅ **Backdate prior usage & edit pack size on subscriptions** ([#2](https://github.com/biswan07/fusion-steps/issues/2), [PR #3](https://github.com/biswan07/fusion-steps/pull/3)) — Teachers can record classes a returning student attended *before* a pack was assigned (by date or by quick "already used" count), and can resize an active pack from 5 to 10 (or any size) after the fact. Both flows feed a typed `editHistory[]` audit trail rendered on the student profile. Mutations route through a new teacher-gated `editSubscription` callable inside a Firestore transaction; backdated attendance docs carry `isBackdated: true` and the trigger short-circuits before either FCM send. **Two latent bugs caught by the Playwright E2E pass:** `firebase-admin` v12 namespace pattern (`admin.firestore.FieldValue.arrayUnion`) is `undefined` under the functions emulator runtime — switched to modular `firebase-admin/firestore` imports; the history sort used `new Date(timestamp)` which returns NaN for Firestore Timestamp objects, breaking reverse-chronological ordering. (April 25, 2026)
- ✅ **FCM service worker config + storage rule tightening** — `vite.config.ts` now substitutes `__VITE_FIREBASE_*__` placeholders into `public/firebase-messaging-sw.js` at build time so background notifications can resolve runtime keys (the SW can't read `import.meta.env`). `storage.rules` tightened on video reads. (April 25, 2026)

### March 2026

- ✅ **Cloud Functions upgraded to Node 20** — Bumped the runtime in `functions/package.json` to align with the current Firebase Functions support matrix. (March 27, 2026)
- ✅ **Comprehensive bug audit pass** — Resolved every critical, high, and medium issue surfaced by an end-to-end audit, including infinite loading on all pages and several attendance/subscription edge cases. (March 27, 2026)
- ✅ **Netlify SPA redirect** — Added `public/_redirects` so deep links and refreshes don't 404 on the Netlify CDN. (March 26, 2026)
- ✅ **First production cut** — Initial release of the dance academy management app: teacher dashboard, batch management, attendance marking with AEST dedupe, student profiles, class-pack assignment, video library with batch-scoped fan-out via FCM. (March 26, 2026)

---

## Features

### 👩‍🏫 Teacher experience

- **Dashboard** — Today's batches, quick stats (active students, low-balance students, expiring packs).
- **Batches** — Create, edit, and archive batches; view batch detail with the full student roster and attendance history.
- **Mark attendance** — One-tap present/absent toggle per student, AEST-aware duplicate prevention (a teacher can't accidentally submit twice across midnight UTC), confirmation dialog before commit.
- **Students** — Full student CRUD via the `createStudent` callable (atomically creates Auth user + Firestore doc + password-reset link), batch assignments, parent/guardian metadata for minors.
- **Student profile** — Active-pack card with `Edit pack`, `Add past attendance`, and an expandable `History` strip; recent attendance feed; batch membership management.
- **Pack assignment** — 5/10/20-class packs with category-aware fee preview (Children/Teen $18/class, Women $23/class, with $200 women / $150 standard 10-pack pricing); optional "already attended" section for backdating at assign time (by date or by count).
- **Video library** — Upload videos, fan-out FCM notifications to all students in the assigned batches, batch-scoped read access at the Firestore-document level.

### 🎓 Student experience

- **Home** — Today's date in DD/MM/YYYY AEST, current pack balance with red/orange/green threshold colours (≤2 red, ≤4 orange), greeting based on AEST hour.
- **Attendance history** — Reverse-chronological list of attended classes.
- **Video library** — Style-tagged videos for the batches the student is enrolled in.
- **Profile** — Student-editable fields gated to `fcmToken` only (everything else is teacher-managed via callable).

### Cross-cutting

- **Offline-tolerant** — Firestore `persistentLocalCache` keeps recent reads available offline; `OfflineBanner` surfaces connectivity state.
- **PWA-installable** — Manifest with maskable icons, Vite PWA plugin with autoUpdate, runtime caching for Firestore reads (NetworkFirst, 50 entries, 24h).
- **Phone-or-email login** — Phone-only accounts use a synthetic email format `phone_<digits>@fusionsteps.app`; both `LoginPage` and the teacher's "Add Student" form share the translation helper, and any change must be applied in both places (called out in [CLAUDE.md](CLAUDE.md)).
- **Brand palette** — Inline Tailwind palette (no CSS vars) — `#1A1A2E` background, `#00BCD4` cyan, `#FF6F00` orange, `#E91E8C` pink, `#7B2D8B` purple. Fonts: Inter for body, Dancing Script for display.

---

## Architecture

### System overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                            React SPA (Vite)                          │
│                                                                      │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │  /login        │  │  /teacher/*      │  │  /student/*          │ │
│  │  LoginPage     │  │  TeacherLayout   │  │  StudentLayout       │ │
│  │                │  │  (bottom nav)    │  │  (bottom nav)        │ │
│  └────────────────┘  └──────────────────┘  └──────────────────────┘ │
│                              │                       │              │
│                      ProtectedRoute (role gate, useAuth)            │
│                              │                                       │
│         ┌─────────── one hook per collection ───────────┐            │
│         │  useStudents · useBatches · useAttendance ·   │            │
│         │  useSubscriptions · useVideos · useAuth       │            │
│         │  (onSnapshot + unsubscribe in useEffect)      │            │
│         └──────────────────────┬───────────────────────┘            │
└────────────────────────────────┼────────────────────────────────────┘
                                 │ Firebase JS SDK v11
                                 │ (auth + firestore + storage + messaging + functions)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Firebase backend                            │
│                                                                      │
│  Auth (email/password, phone synthetic email)                       │
│                                                                      │
│  Firestore                  Cloud Storage         Cloud Messaging   │
│  ├── users/{uid}            └── videos/...        (FCM tokens on    │
│  ├── batches/{id}                                  users/{uid})     │
│  ├── attendance/{id}                                                 │
│  ├── subscriptions/{id}                                              │
│  └── videos/{id}                                                     │
│                                                                      │
│  Cloud Functions (Node 20)                                          │
│  ├── createStudent              callable, teacher-only              │
│  ├── editSubscription           callable, teacher-only, transactional│
│  ├── onAttendanceCreated        Firestore trigger, FIFO + FCM        │
│  └── onVideoCreated             Firestore trigger, batch FCM fan-out │
└─────────────────────────────────────────────────────────────────────┘
```

### Routing & auth

- **Two role-gated trees** under `<ProtectedRoute requiredRole="...">` — `/teacher/*` and `/student/*`. Unknown routes redirect to `/login`. (See [src/App.tsx](src/App.tsx).)
- **`useAuth`** subscribes to `onAuthStateChanged`, looks up `users/{uid}`, and exposes `{ user, role, loading }`. `ProtectedRoute` redirects to the correct role tree if the user is signed in but mismatched.
- **Login** accepts an email or a phone number; phone numbers are translated to the synthetic email format before `signInWithEmailAndPassword`. (See [src/pages/LoginPage.tsx](src/pages/LoginPage.tsx).)

### Data model (Firestore)

| Collection | Shape (selected fields) |
|---|---|
| `users/{uid}` | `role: 'teacher' \| 'student'`, `batchIds: string[]`, `fcmToken?`, `studentCategory: 'Children' \| 'Teen' \| 'Women'`, `enrollmentType: 'Term' \| 'Casual'`, `parentName?`, `parentPhone?` |
| `batches/{id}` | `name`, `dayOfWeek`, `time`, `style: 'Bollywood' \| 'Western' \| 'Fusion'`, `level`, `studentIds: string[]`, `isActive` |
| `attendance/{id}` | `batchId`, `studentId`, `studentName`, `batchName`, `date: Timestamp`, `status: 'present' \| 'absent'`, `markedBy`, `isBackdated?: boolean` |
| `subscriptions/{id}` | `studentId`, `packSize: 1 \| 5 \| 10 \| 20`, `classesRemaining`, `assignedBy`, `assignedAt`, `isActive`, `editHistory?: EditEntry[]` |
| `videos/{id}` | `title`, `description`, `style`, `batchIds: string[]`, `storageUrl`, `thumbnailUrl` |

**Composite indexes** (in `firestore.indexes.json`):

- `subscriptions(isActive ASC, classesRemaining ASC)` — used by low-balance dashboards
- `subscriptions(studentId ASC, isActive ASC, assignedAt ASC)` — used by the FIFO decrement query in `onAttendanceCreated`

### Cloud Functions

The `functions/` workspace ships four functions, all on Node 20 and `firebase-functions@5`:

| Function | Type | Purpose |
|---|---|---|
| `createStudent` | `onCall`, teacher-only | Validates input, creates the Auth user, creates the `users/{uid}` Firestore doc, generates a password-reset link for the invite email. |
| `editSubscription` | `onCall`, teacher-only | Two ops — `resize` (change `packSize` and `classesRemaining`) and `backdate-count` (decrement `classesRemaining` by `usedCount` retroactively). Runs inside `runTransaction`. Validates ranges, appends a typed `EditEntry` to `editHistory` via `FieldValue.arrayUnion`, flips `isActive=false` at zero. |
| `onAttendanceCreated` | Firestore trigger on `attendance/{id}` create | FIFO decrement (oldest active subscription first), `isActive=false` at zero, FCM low-balance alert at ≤2 remaining, FCM attendance receipt — **all FCM sends suppressed** when the new doc has `isBackdated: true`, in which case a `backdate-dates` audit entry is appended to the target subscription's `editHistory`. |
| `onVideoCreated` | Firestore trigger on `videos/{id}` create | Resolves all student UIDs across `batchIds`, fans out an FCM notification with the video title to each student's `fcmToken`. |

> ⚠️ **Modular `firebase-admin/firestore` imports are required.** The namespace pattern `admin.firestore.FieldValue.arrayUnion(...)` works in plain Node but is `undefined` under the firebase-functions emulator runtime in `firebase-admin@12`, crashing the trigger and the callable. All trigger/callable code in this repo imports `FieldValue`, `Timestamp`, and `getFirestore` from `firebase-admin/firestore` directly. The unit-test mock helper at [functions/tests/helpers.ts](functions/tests/helpers.ts) stubs both module paths so the existing 19 unit tests still cover the new import shape.

### Subscription engine — invariants and audit trail

The subscription model is the most failure-sensitive part of the app, because balances directly correspond to money owed. The codebase enforces three invariants:

1. **Server-only deduction.** `onAttendanceCreated` is the *only* path that decrements `classesRemaining` for normal attendance. The client never touches `classesRemaining` outside of two cases: initial `assignedAt`-time creation, and the optional one-shot `backdate-count` write at assign time. After creation, all mutations route through the `editSubscription` callable.
2. **Single active pack per student.** `AssignSubscription.tsx` deactivates any existing active subscriptions before creating a new one, so the FIFO decrement always targets exactly one row.
3. **Locked field surface from the client.** [`firestore.rules`](firestore.rules) restricts client `update` operations on `subscriptions/{id}` to `isActive` only. Any attempt to write `classesRemaining`, `packSize`, or `editHistory` from the client is rejected — they go through the callable, which uses the admin SDK.

#### Backdate flow (April 2026)

```text
                       (1) by date                              (2) by count
Teacher selects pack ──────────────────►  AssignSubscription writes attendance docs
                                          with isBackdated:true
                                                  │
                                                  ▼
                       onAttendanceCreated trigger fires per doc
                                                  │
                                                  ├── FIFO decrement classesRemaining
                                                  ├── append `backdate-dates` to editHistory
                                                  └── SKIP both FCM sends
                                                  ▼
                                          Subscription updated atomically


Existing pack ──► StudentProfile → "Edit pack" or "Add past attendance"
                                                  │
                                                  ▼
                                       editSubscription callable
                                                  │
                                          runTransaction:
                                          ├── txn.get(subRef)
                                          ├── validate op (resize / backdate-count)
                                          ├── compute new packSize / classesRemaining
                                          ├── update doc + arrayUnion editHistory entry
                                          └── isActive=false at zero
                                                  ▼
                                          Returns { ok: true }
```

**Audit shape** — every mutation appends one entry:

```ts
type EditEntry = {
  action: 'backdate-dates' | 'backdate-count' | 'resize'
  editedBy: string             // teacher uid
  editedAt: Timestamp
  oldValue: { packSize: PackSize; classesRemaining: number }
  newValue: { packSize: PackSize; classesRemaining: number }
  dates?: Date[]               // present for backdate-dates
  reason?: string              // optional, free text (future)
}
```

The student profile renders this in reverse-chronological order via `formatEditEntry` in [src/utils/editHistory.ts](src/utils/editHistory.ts). The formatter coerces `Timestamp`/`Date`/`{ seconds }` shapes safely — `new Date(timestamp)` on a Firestore Timestamp returns `NaN` and silently breaks ordering, which the Playwright E2E run caught.

---

## Tech Stack

### Frontend

| Layer | Choice | Notes |
|---|---|---|
| Framework | **React 19** | Concurrent features, transitions for dialog open/close. |
| Language | **TypeScript 5.7** | `strict` mode, type-only imports. |
| Build | **Vite 6** | ESM dev server, lightning-fast HMR. |
| Routing | **react-router-dom v7** | `BrowserRouter`, role-gated nested routes. |
| Styling | **Tailwind CSS 4** | Inline palette, no CSS vars; Inter + Dancing Script fonts. |
| PWA | **vite-plugin-pwa 0.21** | autoUpdate strategy, manifest, runtime Firestore cache. |
| Testing | **vitest 3 + jsdom + @testing-library/react** | Unit and integration tests under `tests/`. |
| E2E | **@playwright/test** | Real Chromium against the Firebase emulator stack. |

### Backend

| Layer | Choice | Notes |
|---|---|---|
| Database | **Firestore (Native mode)** | `persistentLocalCache` on the client; composite indexes for FIFO and active-pack queries. |
| Auth | **Firebase Auth** | Email/password + synthetic email for phone-only accounts. |
| Storage | **Cloud Storage** | Video uploads; batch-scoping enforced at Firestore-doc level (storage rules permissive — see [Roadmap](#roadmap)). |
| Cloud Functions | **firebase-functions v5 + firebase-admin v12 on Node 20** | Modular `firebase-admin/firestore` imports throughout. |
| Push notifications | **Firebase Cloud Messaging (FCM)** | Web tokens stored on `users/{uid}.fcmToken`; SW at `public/firebase-messaging-sw.js`. |

### Tooling

| Tool | Purpose |
|---|---|
| **firebase-tools 15.10** | Local emulator suite: auth, firestore, functions, storage. |
| **OpenJDK 21** | Required by `firebase-tools` for the Firestore emulator JVM. |
| **firebase-functions-test 3.3** | Offline-mode harness for unit-testing triggers and callables. |
| **Playwright 1.59** | E2E browser automation; pre-kills leaked emulator JVMs in `webServer.command`. |
| **tsx** | TypeScript execution for the seed script (`e2e/seed.ts`). |

### Hosting & ops

- **Frontend** — Netlify, with `public/_redirects` providing the SPA fallback (`/* /index.html 200`).
- **Functions / Firestore / Storage** — Firebase project, deployed via `firebase deploy --only functions`, `--only firestore:rules`, etc.
- **Backlog** — [GitHub Project #7](https://github.com/users/biswan07/projects/7/views/1) is the canonical issue tracker. Status flow: Backlog → Ready → In progress → In review → Done.

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm 10+**
- **Firebase project** with Firestore (Native mode), Auth (email/password), Storage, Cloud Messaging, and Cloud Functions enabled
- **A Web App** registered in the Firebase console (yields the public config keys + VAPID key for FCM)
- For E2E only: **firebase-tools** (`npm i -g firebase-tools`) and **OpenJDK 21** (`brew install openjdk@21` on macOS)

### Installation

```bash
# Clone
git clone https://github.com/biswan07/fusion-steps.git
cd fusion-steps

# PWA dependencies
npm install

# Cloud Functions dependencies
cd functions && npm install && cd ..
```

### Environment variables

Create `.env` (see `.env.example`) with your Firebase Web App config:

```dotenv
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=fusion-steps-9b54b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=fusion-steps-9b54b
VITE_FIREBASE_STORAGE_BUCKET=fusion-steps-9b54b.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
VITE_FIREBASE_VAPID_KEY=BLp...   # FCM Web Push certificate key

# Optional — set to '1' to point the SPA at the local emulator stack instead of prod
VITE_USE_EMULATOR=0
```

> If the env vars are missing, [`isFirebaseConfigured`](src/firebase.ts) returns `false` and the app renders `<SetupScreen />` — handy for fresh clones, painful if you forgot to copy `.env`. Always check `.env` first when "nothing renders."

### Development

```bash
npm run dev           # Vite dev server at http://localhost:5173
npm run build         # tsc -b && vite build → dist/
npm run preview       # Serve the production build locally
```

### Running with the local Firebase emulator stack

The `e2e/` setup doubles as a great local development sandbox — you can point the dev server at the emulator and develop without touching production data.

```bash
# Terminal 1 — boot the emulator suite (auth + firestore + functions + storage)
JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" \
firebase emulators:start --only auth,firestore,functions,storage --project demo-fusion-steps

# Terminal 2 — Vite dev server pointed at the emulator
VITE_USE_EMULATOR=1 npm run dev

# (Optional) Seed deterministic test data
npm run e2e:seed
```

Emulator ports (see [firebase.json](firebase.json)): auth `9099`, functions `5001`, firestore `8088` *(moved off the default 8080 to dodge common collisions)*, storage `9199`. The emulator UI at `http://localhost:4000` lets you browse Firestore, view function logs, and inspect auth users.

---

## Project Structure

```text
fusion-steps/
├── src/
│   ├── App.tsx                    Routes — /teacher/* and /student/* under ProtectedRoute
│   ├── firebase.ts                App init + persistentLocalCache + emulator wiring + FCM token registration
│   ├── hooks/use*.ts              Real-time Firestore subscriptions (one hook per collection)
│   ├── pages/
│   │   ├── LoginPage.tsx          Email-or-phone login with synthetic email translation
│   │   ├── teacher/               Dashboard, BatchList/Detail, MarkAttendance, StudentList/Profile,
│   │   │                          AssignSubscription, VideoList/Upload
│   │   └── student/               StudentHome, AttendanceHistory, VideoLibrary, StudentProfilePage
│   ├── layouts/                   TeacherLayout, StudentLayout (bottom-nav shells)
│   ├── components/                ProtectedRoute, SetupScreen, AppHeader, OfflineBanner, BatchCard,
│   │                              PackEditDialog, PunchCard, SubscriptionBadge, VideoCard
│   ├── lib/callables.ts           Wrapper for httpsCallable('editSubscription')
│   ├── utils/
│   │   ├── dates.ts               AEST helpers — formatDateDDMMYYYY, getAESTDate, getCurrentDayAEST
│   │   ├── editHistory.ts         formatEditEntry / actionLabel — Timestamp-safe history rendering
│   │   └── subscriptions.ts       Balance colour/label thresholds (≤2 red, ≤4 orange)
│   └── types.ts                   AppUser, Batch, AttendanceRecord, Subscription, Video,
│                                  EditEntry, SubscriptionEditAction, PackSize
│
├── functions/
│   ├── src/
│   │   ├── createStudent.ts       Callable, teacher-only — Auth + Firestore + reset link
│   │   ├── editSubscription.ts    Callable, teacher-only — resize / backdate-count, transactional
│   │   ├── onAttendanceCreated.ts Trigger — FIFO + FCM (with isBackdated short-circuit)
│   │   ├── onVideoCreated.ts      Trigger — batch FCM fan-out
│   │   └── index.ts               Entrypoint, admin.initializeApp()
│   ├── tests/
│   │   ├── helpers.ts             firebase-admin mock harness (covers both legacy and modular import paths)
│   │   ├── editSubscription.test.ts
│   │   └── onAttendanceCreated.test.ts
│   └── vitest.config.ts
│
├── tests/                         PWA unit + integration tests (mirrors src/)
│   ├── components/                ProtectedRoute, SubscriptionBadge, PackEditDialog
│   ├── pages/teacher/             AssignSubscription, StudentProfile
│   └── utils/                     dates, subscriptions, editHistory
│
├── e2e/                           Playwright end-to-end specs
│   ├── seed.ts                    firebase-admin → emulator deterministic seed
│   ├── helpers.ts                 signInAsTeacher, getActiveSub, waitFor utilities
│   ├── global-setup.ts            Waits for emulators, runs seed
│   ├── auth.spec.ts               Sign-in sanity
│   ├── us1-backdate-by-date.spec.ts
│   ├── us2-backdate-by-count.spec.ts
│   ├── us3-backdate-existing.spec.ts
│   ├── us4-resize.spec.ts
│   └── us5-history.spec.ts
│
├── public/
│   ├── _redirects                 Netlify SPA fallback
│   ├── firebase-messaging-sw.js   FCM background handler (Vite injects keys at build time)
│   └── assets/                    PWA icons (72/96/128/144/152/192/384/512)
│
├── docs/
│   ├── superpowers/plans/         Implementation plans (e.g., 2026-04-25-backdate-and-edit-pack.md)
│   └── superpowers/               Workflow notes
│
├── firebase.json                  Emulator ports + function source path + storage rules
├── firestore.rules                Role-gated rules; subscription update locked to isActive only
├── firestore.indexes.json         Composite indexes for FIFO + active-pack queries
├── storage.rules                  Permissive read for authed users (TODO: signed URLs)
├── playwright.config.ts           webServer boots emulators + Vite, pre-kills leaked JVM
├── vite.config.ts                 Vite + Tailwind + PWA plugin + FCM SW templater
└── CLAUDE.md                      Project guide for the AI coding harness
```

---

## Testing

The project ships **three independent test layers**, all green on `main`:

| Layer | Runner | Where | What it covers |
|---|---|---|---|
| **PWA unit + integration** | vitest 3 + jsdom + Testing Library | `tests/` | 39 tests — types, util functions (AEST dates, edit-history formatting, balance colours), `PackEditDialog` validation, `AssignSubscription` and `StudentProfile` integration with mocked Firestore. |
| **Cloud Functions unit** | vitest 3 + firebase-functions-test + admin mocks | `functions/tests/` | 19 tests — `editSubscription` auth gate, resize math, backdate-count math, validation bounds; `onAttendanceCreated` FCM-skip on `isBackdated`, FIFO decrement, editHistory append, regression on the non-backdated path. |
| **End-to-end** | Playwright 1.59 in real Chromium | `e2e/` | 7 specs — login sanity + one spec per user story (US-1..US-5). Each spec drives the browser through the actual DOM and verifies Firestore state via the admin SDK. |

### Run the suites

```bash
# PWA unit + integration (jsdom)
npm test
npm run test:watch

# Cloud Functions unit (Node)
cd functions && npm test
cd functions && npm run test:watch

# Playwright E2E (boots emulator stack + Chromium)
npm run test:e2e         # headless
npm run test:e2e:ui      # UI mode (interactive)

# Seed the emulator manually (when developing, not under Playwright)
npm run e2e:seed
```

### What the E2E suite specifically verifies

| Spec | DOM path | State assertion (via admin SDK) |
|---|---|---|
| `auth.spec.ts` | Login → `/teacher/dashboard` | — |
| `us1-backdate-by-date` | Assign 10-pack with two backdated dates | 2 attendance docs with `isBackdated: true`; trigger leaves sub at `classesRemaining=8`; two `backdate-dates` editHistory entries |
| `us2-backdate-by-count` (×2) | Assign 10-pack with `usedCount=3` ; assign 5-pack with `usedCount=5` | `classesRemaining=7`/`isActive=true` ; `classesRemaining=0`/`isActive=false` |
| `us3-backdate-existing` | StudentProfile → "Add past attendance" → 2 | `editSubscription` callable lands; sub at `classesRemaining=8`; one `backdate-count` editHistory entry |
| `us4-resize` | StudentProfile → "Edit pack" → 5/3 → 10 | `packSize=10`, `classesRemaining=8`, `resize` editHistory entry |
| `us5-history` | Backdate-count then resize, expand History | Both labels render in reverse-chronological order |

### Recommended test budget

- **Unit** for pure logic and validation (always)
- **Functions unit** for any new trigger or callable (always)
- **E2E** for any feature that mutates `classesRemaining`, `packSize`, `editHistory`, or that gates an FCM send — these are the failure modes that ship to production silently

The April 2026 backdate work uncovered two latent bugs only at the E2E layer (modular `firebase-admin` imports + Firestore Timestamp coercion), confirming the budget.

---

## Conventions

**Non-negotiable** for any code touching this repo (see [CLAUDE.md](CLAUDE.md)):

| Concern | Rule |
|---|---|
| **Dates** | DD/MM/YYYY, Australia/Sydney timezone. Always use `formatDateDDMMYYYY` / `getAESTDate` / `getCurrentDayAEST` from [src/utils/dates.ts](src/utils/dates.ts). Never `new Date().toLocaleDateString()` raw. |
| **Currency** | AUD. The fee table is hardcoded in `StudentList.tsx` (`FEE_TABLE`) — keep it in sync if pricing changes. |
| **Theme palette** | Inline Tailwind values (no CSS vars): `#1A1A2E` background, `#00BCD4` cyan, `#FF6F00` orange, `#E91E8C` pink, `#7B2D8B` purple. Body font: Inter; display: Dancing Script. |
| **Routing** | Two role-gated trees under `ProtectedRoute`. Unknown routes → `/login`. Layout component owns the bottom navigation. |
| **Hooks pattern** | `onSnapshot` inside `useEffect`; return the unsubscribe. Sort and transform inside the hook, not the component. |
| **Firestore query caps** | `in` ≤ 30 items (`useBatchStudents`), `array-contains-any` ≤ 10 (`useBatchVideos`). Both are worked around with `.slice()` — be aware when adding new queries. |
| **Imports in `functions/`** | Modular `firebase-admin/firestore` for `FieldValue`, `Timestamp`, `getFirestore`. Never `admin.firestore.FieldValue.*`. |

---

## Security & rules

- **Role gate** — `isTeacher()` evaluates to `true` only when `users/{request.auth.uid}.role == 'teacher'`. `isOwner(userId)` evaluates to `true` when the request user matches the doc owner.
- **Subscription update lock** — Teachers can `create` a subscription doc and can `update` only the `isActive` field. Mutations to `classesRemaining`, `packSize`, or `editHistory` *must* go through the `editSubscription` callable (which uses the admin SDK and bypasses rules). This preserves the server-only deduction invariant called out in [CLAUDE.md](CLAUDE.md).
- **`isBackdated` FCM suppression** — Backdated attendance docs still drive the FIFO decrement, but the trigger short-circuits before `messaging.send`. Any new attendance-side notification path must check `data.isBackdated === true`.
- **Storage rules** — Currently permissive for authenticated reads (any authed user can fetch any video URL). Batch-scoping is enforced only at the Firestore-doc level (`videos/{id}`). Listed under [Roadmap](#roadmap) for tightening to signed URLs.
- **FCM service worker** — `public/firebase-messaging-sw.js` cannot read `import.meta.env`. `vite.config.ts`'s `fcmSwTemplate` plugin substitutes the keys at build time via `__VITE_FIREBASE_*__` placeholders. The 25 April 2026 fix made this actually work in production.
- **Phone synthetic email** — `phone_<digits>@fusionsteps.app`. Both `LoginPage.tsx` and `StudentList.tsx` (`AddStudentForm`) translate it. Don't break this without updating both.

---

## Deployment

### Frontend (Netlify)

1. **Build**

   ```bash
   npm run build
   ```

2. **Deploy** — connect the GitHub repo in Netlify, set build command `npm run build`, publish directory `dist`. The `public/_redirects` file is included in the build output and provides the SPA fallback (`/* /index.html 200`).

3. **Environment variables** (Netlify UI → Site settings → Environment):

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_VAPID_KEY`

### Cloud Functions

```bash
cd functions
npm run build       # tsc → lib/
npm run deploy      # firebase deploy --only functions
```

The function source is at `functions/src/`, the build output at `functions/lib/`. The Firebase Functions emulator and the cloud runtime both pick up the compiled JS, so always run `npm run build` before `npm run deploy` (or use `npm run serve` which builds and starts the emulator in one go).

### Firestore rules and indexes

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Composite indexes can take several minutes to build the first time — the FIFO `subscriptions(studentId, isActive, assignedAt)` index is required for `onAttendanceCreated` to work.

### Storage rules

```bash
firebase deploy --only storage
```

---

## Roadmap

Tracked on [GitHub Project #7](https://github.com/users/biswan07/projects/7/views/1):

- 🔒 **Signed URLs for video reads** — Tighten `storage.rules` so videos require a short-lived signed URL minted by a callable, instead of any authenticated user being able to read any video object.
- 📧 **Invite email dispatch** — `createStudent` already generates a password-reset link; wire it to a transactional email service (Resend / Postmark) so students get an actual invite.
- 📅 **Bulk backdating across multiple students** — Out of scope for [#2](https://github.com/biswan07/fusion-steps/issues/2); revisit if Sriparna asks for term-onboarding workflows.
- 🧾 **Free-text reason field on `EditEntry`** — Already in the data model, no UI yet.
- 👁️ **Student-side visibility of edit history** — Currently teacher-only; consider exposing a read-only summary on the student home if pack questions become a support load.
- 🧪 **CI E2E run** — The Playwright suite runs locally; add a GitHub Actions workflow that boots the emulator and runs it on every PR.

---

## Stakeholder & contributing

This is a single-stakeholder app. **Sriparna Dutta** is the sole teacher, the sole user of the teacher tree, and the source of truth for every requirement. Her feedback is captured verbatim in GitHub issues on Project #7 before any code is written.

**Contribution workflow** for the development team:

1. **Brainstorm + issue** — Translate Sriparna's feedback into an exhaustive GitHub issue with user stories (US-N), acceptance criteria (AC-N), technical design, validation summary, and out-of-scope list. Brainstorming and code never share a context window.
2. **Plan** — Write an implementation plan in `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` with TDD-ordered, bite-sized tasks. Plans reference real file paths and contain the actual code an engineer types.
3. **Implement** — Test-first per task. Each task ends with a commit. Frequent commits, no batching.
4. **Verify** — All three test layers green (PWA unit, functions unit, Playwright E2E) before opening a PR. For money-adjacent features (subscription balances, FCM gates), the E2E pass is non-negotiable.
5. **Ship** — Squash-merge to `main` with a "Closes #N" PR body. Move the issue on Project #7 from "In review" → "Done".

---

## License

This project is **proprietary**. All rights reserved. Unauthorized copying, distribution, modification, or any other use is strictly prohibited.

---

## Support

For support, please contact **Biswanath Dutta** (project lead) or **Sriparna Dutta** (Fusion Steps Dance Academy, Sydney).

---

## Acknowledgments

- **Sriparna Dutta** — Stakeholder, teacher, source of every requirement. The app exists because she needed it.
- **Firebase** — Auth, Firestore, Cloud Functions, Cloud Messaging, Cloud Storage. The whole backend.
- **Netlify** — Frontend hosting + serverless build.
- **Vite, React, Tailwind, Playwright** — The frontend toolchain that made a single-operator-friendly codebase possible.

---

**Last Updated:** April 25, 2026
**Latest feature:** Backdate prior usage and edit pack size on subscriptions ([#2](https://github.com/biswan07/fusion-steps/issues/2), [PR #3](https://github.com/biswan07/fusion-steps/pull/3))
**Test counts on `main`:** 39 PWA tests · 19 Cloud Functions tests · 7 Playwright E2E tests
