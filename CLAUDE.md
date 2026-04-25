# Fusion Steps — Claude Code Guide

PWA for Fusion Steps Dance Academy (Sriparna Dutta, Sydney). Two roles: teacher and student.
Built on Firebase. Mobile-first, offline-tolerant.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build (PWA bundle)
npm run preview      # serve the production build
npm run lint         # eslint .
npm test             # vitest run (jsdom)
npm run test:watch   # vitest watch

# Cloud Functions (cd functions/)
npm run build        # tsc → lib/
npm run serve        # build + firebase emulators:start --only functions
npm run deploy       # firebase deploy --only functions
```

Firebase emulator ports (see `firebase.json`): auth 9099 · functions 5001 · firestore 8080 · storage 9199 · UI enabled.

## Architecture

```
src/
  App.tsx              Routes (react-router-dom v7) — /teacher/* and /student/* under ProtectedRoute
  firebase.ts          App init + persistentLocalCache + FCM token registration
  hooks/use*.ts        Real-time Firestore subscriptions (one hook per collection)
  pages/teacher/       Dashboard, BatchList/Detail, MarkAttendance, StudentList/Profile,
                       AssignSubscription, VideoList/Upload
  pages/student/       StudentHome, AttendanceHistory, VideoLibrary, StudentProfilePage
  layouts/             TeacherLayout, StudentLayout (bottom-nav shells)
  components/          ProtectedRoute, SetupScreen, AppHeader, OfflineBanner, BatchCard,
                       PunchCard, SubscriptionBadge, VideoCard
  utils/dates.ts       AEST helpers — formatDateDDMMYYYY, getAESTDate, getCurrentDayAEST
  utils/subscriptions  Balance colour/label thresholds (≤2 red, ≤4 orange)
  types.ts             AppUser, Batch, AttendanceRecord, Subscription, Video
functions/src/
  createStudent.ts     onCall, teacher-only — creates Auth user + users/{uid} doc + reset link
  onAttendanceCreated  Firestore trigger — FIFO subscription decrement + FCM (low-balance + receipt)
  onVideoCreated       Firestore trigger — fans out FCM to all students in batch
public/firebase-messaging-sw.js   FCM background handler (see Gotchas)
```

## Data model (Firestore)

- `users/{uid}` — role: 'teacher' | 'student', batchIds[], fcmToken?, studentCategory, enrollmentType, parent*
- `batches/{id}` — dayOfWeek, time, style (Bollywood/Western/Fusion), level, studentIds[]
- `attendance/{id}` — batchId, studentId, date (Date), status (present/absent), markedBy
- `subscriptions/{id}` — studentId, packSize (1/5/10/20), classesRemaining, isActive, assignedAt
- `videos/{id}` — style, batchIds[], storageUrl, uploadedAt

Security in `firestore.rules`: teachers full access, students read only their own. Storage rule is permissive (any auth'd user can read videos) — see TODO in `storage.rules` about signed URLs.

## Conventions

- **Dates:** DD/MM/YYYY, Australia/Sydney timezone. Use `formatDateDDMMYYYY` / `getAESTDate` from `src/utils/dates.ts`. Never `new Date().toLocaleDateString()` raw.
- **Currency:** AUD. Fee table is hardcoded in `StudentList.tsx` (`FEE_TABLE`) — keep it in sync if pricing changes.
- **Theme palette (inline Tailwind, no CSS vars):** `#1A1A2E` bg · `#00BCD4` cyan · `#FF6F00` orange · `#E91E8C` pink · `#7B2D8B` purple. Font: Inter; display: Dancing Script.
- **Routing:** Two role-gated trees under `ProtectedRoute`. Unknown routes → `/login`.
- **Hooks pattern:** `onSnapshot` in `useEffect`, return unsubscribe. Sort/transform in the hook, not the component.

## Gotchas

- **Subscription deduction is server-only.** `onAttendanceCreated` decrements FIFO (oldest active first) and flips `isActive=false` at zero. Never decrement client-side or you'll double-deduct.
- **Attendance dedupe** uses AEST day bounds (`MarkAttendance.tsx`), not UTC. UTC bounds would let a teacher submit twice across midnight UTC.
- **Phone login → synthetic email.** Phone-only accounts use `phone_<digits>@fusionsteps.app`. `LoginPage.tsx` and `StudentList.tsx` (`AddStudentForm`) both translate. Don't break this without updating both.
- **Firestore query caps:** `in` ≤ 30 items (`useBatchStudents`), `array-contains-any` ≤ 10 (`useBatchVideos`). Both are worked around with `.slice()` — be aware when adding new queries.
- **Composite indexes** in `firestore.indexes.json`: `subscriptions(isActive, classesRemaining)` and `subscriptions(studentId, isActive, assignedAt)`. The FIFO query in `onAttendanceCreated` depends on the second one.
- **FCM service worker** (`public/firebase-messaging-sw.js`) cannot read `import.meta.env`. `vite.config.ts` injects keys via `define: __VITE_FIREBASE_*__` — but the file currently has empty literals and the `define` keys don't actually match what the SW reads. **Fix this before relying on background notifications.**
- **`isFirebaseConfigured`** gates the whole app — missing env vars render `<SetupScreen />`. Don't crash silently; check `.env` first when "nothing renders".
- **Storage videos are world-readable to any authenticated user.** Batch-scoping is only enforced at the Firestore-document level (`videos/{id}` rule). The TODO in `storage.rules` calls for signed URLs.

## Environment

`.env` (see `.env.example`):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
```

## Testing

`tests/` at repo root, mirrors `src/`. Setup: `tests/setup.ts` imports `@testing-library/jest-dom/vitest`. Existing coverage is light (ProtectedRoute, SubscriptionBadge, dates, subscriptions). Add tests alongside non-trivial business logic — especially anything touching subscription math or AEST dates.
