# Fusion Steps PWA — Design Spec

**App:** Fusion Steps — by Sriparna Dutta
**Type:** Mobile-first Progressive Web App (PWA)
**Purpose:** Manage Fusion Steps Dance Academy — a Bollywood-first dance school with Western dance elements

## User Roles

### Teacher (Admin)
- Single admin initially, expandable via Firestore role field
- Full control: batches, students, attendance, subscriptions, video uploads
- Creates student accounts (students receive invite email)

### Student
- Individual accounts created by teacher
- View own attendance, subscription balance, and class videos

## Tech Stack

- **Frontend:** React + TypeScript (Vite), Tailwind CSS
- **Backend:** Firebase (Auth + Firestore + Storage + Cloud Messaging)
- **Cloud Functions:** 3 functions for account creation and notifications
- **PWA:** vite-plugin-pwa + Workbox (service worker, web manifest, installable)

## Data Model — Flat Firestore Collections

### `users/{userId}`
| Field | Type | Notes |
|-------|------|-------|
| name | string | |
| email | string | |
| phone | string | |
| role | `"teacher"` \| `"student"` | Role-based auth via Firestore |
| batchIds | string[] | Batches this student belongs to |
| createdAt | timestamp | |
| createdBy | string | Teacher's userId |

### `batches/{batchId}`
| Field | Type | Notes |
|-------|------|-------|
| name | string | e.g., "Wednesday Bollywood Beginners" |
| dayOfWeek | string | e.g., "Wednesday" |
| time | string | e.g., "6:00 PM" |
| style | `"Bollywood"` \| `"Western"` \| `"Fusion"` | |
| level | `"Beginner"` \| `"Intermediate"` \| `"Advanced"` | |
| studentIds | string[] | Bidirectional with users.batchIds |
| isActive | boolean | |
| createdAt | timestamp | |

### `attendance/{attendanceId}`
| Field | Type | Notes |
|-------|------|-------|
| batchId | string | |
| studentId | string | |
| studentName | string | Denormalized |
| batchName | string | Denormalized |
| date | timestamp | |
| status | `"present"` \| `"absent"` | |
| markedBy | string | Teacher userId |
| createdAt | timestamp | |

### `subscriptions/{subscriptionId}`
| Field | Type | Notes |
|-------|------|-------|
| studentId | string | |
| studentName | string | Denormalized |
| packSize | `5` \| `10` \| `20` | |
| classesRemaining | number | Auto-decremented on attendance |
| assignedBy | string | Teacher userId |
| assignedAt | timestamp | |
| isActive | boolean | |

### `videos/{videoId}`
| Field | Type | Notes |
|-------|------|-------|
| title | string | |
| description | string | |
| style | `"Bollywood"` \| `"Western"` \| `"Fusion"` | |
| batchIds | string[] | Which batches can view |
| storageUrl | string | Firebase Storage URL |
| thumbnailUrl | string | |
| uploadedBy | string | |
| uploadedAt | timestamp | |

### Key Relationships
- `users.batchIds` ↔ `batches.studentIds` — bidirectional for fast lookups
- `attendance.studentId` → `users`
- `subscriptions.studentId` → `users`
- `videos.batchIds` → `batches`

## Authentication & Security

### Auth Flow
1. Firebase Auth with email/password
2. Teacher creates student accounts via `createStudent` Cloud Function
3. Cloud Function creates Auth user + Firestore doc + sends password reset email as invite
4. Student sets password via invite link, then logs in normally
5. On login, app reads `users/{uid}.role` to determine UI (teacher vs student)

### Firestore Security Rules
- **users:** Teacher reads/writes all; student reads own doc only
- **batches:** Teacher CRUD; students read batches they belong to
- **attendance:** Teacher CRUD; students read own records
- **subscriptions:** Teacher CRUD; students read own records
- **videos:** Teacher CRUD; students read videos for their batches

## Cloud Functions (3 total)

1. **`createStudent`** (callable) — receives name/email/phone, creates Firebase Auth user, creates Firestore user doc with `role: student`, sends password reset email as invite
2. **`onAttendanceCreated`** (Firestore trigger on `attendance` create) — deducts 1 from active subscription's `classesRemaining`, sends FCM notification to student
3. **`onVideoCreated`** (Firestore trigger on `videos` create) — sends FCM notification to all students in tagged batches

## App Architecture

### Router Structure
```
/login                    → LoginPage
/teacher                  → TeacherLayout
  /teacher/dashboard      → TeacherDashboard
  /teacher/batches        → BatchList → BatchDetail → MarkAttendance
  /teacher/students       → StudentList → StudentProfile → AssignSubscription
  /teacher/videos         → VideoList → VideoUpload
/student                  → StudentLayout
  /student/home           → StudentHome
  /student/attendance     → AttendanceHistory
  /student/videos         → VideoLibrary
  /student/profile        → StudentProfile
```

### Key Components
- **`AuthProvider`** — wraps app, provides user + role context
- **`ProtectedRoute`** — redirects based on role
- **`TeacherLayout` / `StudentLayout`** — bottom tab navigation
- **`AttendanceMarker`** — checkbox list, submit triggers deduction + notification
- **`SubscriptionBadge`** — colour-coded pill (green ≥5, orange 3-4, red ≤2)
- **`VideoCard`** — thumbnail, title, style tag, tap to play
- **`BatchCard`** — name, day/time, student count, style tag

### State Management
- React Context for auth state
- Firestore `onSnapshot` for real-time data — no Redux/Zustand needed
- Each page queries what it needs directly

### PWA Setup
- `vite-plugin-pwa` for service worker generation
- Workbox strategies: app shell (cache-first), Firestore data (network-first with cache fallback)
- Web manifest with icons (72–512px, already generated)
- Installable on Android and iOS home screen

## UI Design

### Branding
- **Colours:** Teal `#00BCD4` (primary), Purple `#7B2D8B` (secondary), Orange `#FF6F00` (CTA), Hot pink `#E91E8C` (notifications/badges), Dark charcoal `#1A1A2E` (background), White (card surfaces)
- **Fonts:** Dancing Script (headings), Inter (body)
- **Logo:** Dancer silhouette with flowing ribbons, "Fusion Steps by Sriparna Dutta"
- **Feel:** Premium, vibrant, celebratory — Bollywood glamour meets clean mobile UI
- **Mode:** Dark mode preferred

### Teacher Dashboard (Stacked Cards layout)
- Header with logo + profile avatar
- Greeting: "Good evening, Sriparna"
- **Today's Batches** section — cards with batch name, time, student count, colour-coded left border by style, "Mark" button
- **Low Balance Alerts** — pink-tinted cards showing students with ≤2 classes remaining
- **Recent Uploads** — video card with thumbnail, title, style tag
- Bottom tab nav: Home, Batches, Students, Videos

### Student Home (Balance-Centred layout)
- Header with logo + profile avatar
- Greeting: "Welcome back, [Name]"
- **Hero balance card** — large gradient card with big number for classes remaining, pack info below
- **Next Class** — orange-accented card with batch name and time
- **Latest notification** — pink-tinted notification card
- Bottom tab nav: Home, Attendance, Videos, Profile

### Other Screens (follow same visual language)
- **Mark Attendance:** Batch header → student list with checkboxes → Submit button
- **Student List:** Search bar → scrollable cards with name, batch tags, subscription badge
- **Video Library:** Style filter tabs (All / Bollywood / Western / Fusion) → video cards grid
- **Login:** Logo centred, email + password fields, dark background
- **Assign Subscription:** Student name header → pack size selector (5/10/20) → confirm button

## Push Notifications

| Trigger | Recipient | Message |
|---------|-----------|---------|
| Attendance marked | Student | "Your attendance for [Batch] on [DD/MM/YYYY] has been marked — Fusion Steps" |
| Subscription ≤ 2 classes | Student | "You have [N] classes left — talk to Sriparna to top up" |
| Video uploaded | Batch students | "New video: [Title] — watch now!" |

## Offline Support

- **Read-only offline** — cached attendance history, subscription balance, and video list viewable offline
- Videos not cached (too large)
- All writes require connection
- Service worker caches app shell for fast loading
- "Offline" banner shown when disconnected, write actions disabled

## Error Handling

- Firebase not configured → friendly setup screen with instructions
- Network offline → cached data + "Offline" banner, write actions disabled
- Video upload fails → retry button with progress indicator
- Subscription at 0 → block attendance marking, show "No classes remaining"

## Testing Strategy

- **Unit tests:** Vitest for utility functions (subscription deduction, date formatting DD/MM/YYYY)
- **Component tests:** React Testing Library for key flows (attendance marking, subscription assignment)
- **E2E:** Manual testing (Playwright not warranted at this scale)
- **Local dev:** Firebase emulators for auth, Firestore, storage, and functions

## Environment

- `.env` for Firebase config keys (API key, project ID, etc.)
- `.env.example` committed with placeholder values
- Friendly setup screen if Firebase is not configured
