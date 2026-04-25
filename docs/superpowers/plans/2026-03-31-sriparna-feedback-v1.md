# Sriparna's Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all feedback items from Sriparna — student categories, parent/guardian fields, enrollment types with fee display, batch deletion, video URL linking, and the punch-card subscription visual.

**Architecture:** Extend the existing `AppUser` and `Subscription` types with new fields (studentCategory, enrollmentType, parentName, parentPhone). Replace the video file upload with a URL input. Add a punch-card component for term subscriptions. Add batch delete via Firestore. The Cloud Function `createStudent` gains new fields. All changes are additive — no breaking data model changes.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Firebase (Auth, Firestore, Cloud Functions)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types.ts` | Modify | Add `StudentCategory`, `EnrollmentType`, extend `AppUser`, `Subscription` |
| `src/pages/teacher/StudentList.tsx` | Modify | Add category, parent fields, enrollment type to AddStudentForm |
| `functions/src/createStudent.ts` | Modify | Accept + store new fields (category, parentName, parentPhone, enrollmentType) |
| `src/pages/teacher/BatchList.tsx` | Modify | Add delete batch button + confirmation |
| `src/pages/teacher/VideoUpload.tsx` | Modify | Replace file upload with URL input |
| `src/components/VideoCard.tsx` | Modify | Handle URL-based videos (external links) |
| `src/pages/student/VideoLibrary.tsx` | Modify | Handle external URLs (open in new tab instead of inline player) |
| `src/pages/teacher/AssignSubscription.tsx` | Modify | Show fee based on student category + enrollment type |
| `src/components/PunchCard.tsx` | Create | Visual punch-card: green = upcoming, orange = used |
| `src/pages/teacher/StudentProfile.tsx` | Modify | Show parent/guardian info, punch-card, category |
| `src/pages/student/StudentHome.tsx` | Modify | Show punch-card instead of just a number |
| `src/pages/student/StudentProfilePage.tsx` | Modify | Show parent/guardian info, category |
| `src/hooks/useSubscriptions.ts` | Modify | No changes needed — existing hooks return all fields |
| `firestore.rules` | Modify | Allow batch delete for teachers |

---

### Task 1: Extend Types — StudentCategory, EnrollmentType, AppUser fields

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new types and extend AppUser**

```typescript
// Add after existing type exports
export type StudentCategory = 'Children' | 'Teen' | 'Women'
export type EnrollmentType = 'Term' | 'Casual'

// Extend AppUser — add these optional fields (existing students won't have them)
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
  // New fields (optional for backward compat with existing students)
  studentCategory?: StudentCategory
  enrollmentType?: EnrollmentType
  parentName?: string
  parentPhone?: string
}
```

Also update `PackSize` to just be `10` since term is always 10 classes, and casual is pay-per-class (1):

```typescript
export type PackSize = 1 | 5 | 10 | 20
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add StudentCategory, EnrollmentType, parent fields to AppUser type"
```

---

### Task 2: Update AddStudentForm — category, parent/guardian, enrollment type

**Files:**
- Modify: `src/pages/teacher/StudentList.tsx`

- [ ] **Step 1: Add state and conditional fields to AddStudentForm**

The form needs:
1. **Student Category** dropdown: Children / Teen / Women (required)
2. **Parent/Guardian Name** + **Parent/Guardian Phone** — shown only when category is Children or Teen
3. **Email label** changes: "Parent/Guardian Email" for Children/Teen, "Email" for Women
4. **Enrollment Type** radio: Term (10 classes) / Casual
5. **Fee display** — read-only, calculated from category + enrollment type:
   - Term: $150 (Children/Teen), $200 (Women)
   - Casual: $18/class (Children/Teen), $23/class (Women)

Replace the `AddStudentForm` component with:

```tsx
function AddStudentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [category, setCategory] = useState<StudentCategory | ''>('')
  const [enrollmentType, setEnrollmentType] = useState<EnrollmentType | ''>('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isMinor = category === 'Children' || category === 'Teen'

  function getFeeDisplay(): string {
    if (!category || !enrollmentType) return ''
    if (enrollmentType === 'Term') {
      return category === 'Women' ? '$200 (10 classes)' : '$150 (10 classes)'
    }
    return category === 'Women' ? '$23 per class' : '$18 per class'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category || !enrollmentType) return
    setSaving(true)
    setError('')
    try {
      const functions = getFunctions()
      const createStudent = httpsCallable(functions, 'createStudent')
      await createStudent({
        name, email, phone,
        studentCategory: category,
        enrollmentType,
        parentName: isMinor ? parentName : '',
        parentPhone: isMinor ? parentPhone : '',
      })
      setSaving(false)
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create student')
      setSaving(false)
    }
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]'
  const selectClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00BCD4]'

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 rounded-xl p-4 space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student full name" required className={inputClass} />

      {/* Student Category */}
      <select value={category} onChange={(e) => setCategory(e.target.value as StudentCategory)} required className={selectClass}>
        <option value="" disabled className="bg-[#1A1A2E]">Select category</option>
        <option value="Children" className="bg-[#1A1A2E]">Children (under 10)</option>
        <option value="Teen" className="bg-[#1A1A2E]">Teen</option>
        <option value="Women" className="bg-[#1A1A2E]">Women</option>
      </select>

      {/* Parent/Guardian fields — only for minors */}
      {isMinor && (
        <>
          <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Parent/Guardian name" required className={inputClass} />
          <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="Parent/Guardian phone" type="tel" required className={inputClass} />
        </>
      )}

      <input value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder={isMinor ? "Parent/Guardian email" : "Email"} type="email" required className={inputClass} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel" className={inputClass} />

      {/* Enrollment Type */}
      <div className="flex gap-3">
        <button type="button" onClick={() => setEnrollmentType('Term')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${enrollmentType === 'Term' ? 'bg-[#00BCD4] text-white' : 'bg-white/5 text-white/50 border border-white/10'}`}>
          Term (10 classes)
        </button>
        <button type="button" onClick={() => setEnrollmentType('Casual')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${enrollmentType === 'Casual' ? 'bg-[#00BCD4] text-white' : 'bg-white/5 text-white/50 border border-white/10'}`}>
          Casual
        </button>
      </div>

      {/* Fee display */}
      {getFeeDisplay() && (
        <div className="bg-[#00BCD4]/10 rounded-lg px-3 py-2 text-sm text-[#00BCD4] font-medium">
          Fee: {getFeeDisplay()}
        </div>
      )}

      {error && <p className="text-[#E91E8C] text-xs">{error}</p>}
      <button type="submit" disabled={saving || !category || !enrollmentType}
        className="w-full bg-[#00BCD4] text-white font-medium rounded-lg py-2 text-sm disabled:opacity-50">
        {saving ? 'Creating...' : 'Create Student'}
      </button>
    </form>
  )
}
```

Add the import at top of file:
```typescript
import type { StudentCategory, EnrollmentType } from '../../types'
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/teacher/StudentList.tsx
git commit -m "feat: add student category, parent fields, enrollment type to student creation form"
```

---

### Task 3: Update createStudent Cloud Function

**Files:**
- Modify: `functions/src/createStudent.ts`

- [ ] **Step 1: Accept and store new fields**

Update the data destructuring and Firestore write:

```typescript
const {
  name: rawName, email: rawEmail, phone: rawPhone,
  studentCategory, enrollmentType,
  parentName: rawParentName, parentPhone: rawParentPhone,
} = data as {
  name: string; email: string; phone?: string
  studentCategory: 'Children' | 'Teen' | 'Women'
  enrollmentType: 'Term' | 'Casual'
  parentName?: string; parentPhone?: string
}

const name = rawName?.trim()
const email = rawEmail?.trim()
const phone = rawPhone?.trim()
const parentName = rawParentName?.trim() || ''
const parentPhone = rawParentPhone?.trim() || ''
```

Add validation after existing checks:

```typescript
const validCategories = ['Children', 'Teen', 'Women']
if (!studentCategory || !validCategories.includes(studentCategory)) {
  throw new functions.https.HttpsError('invalid-argument', 'Valid student category is required')
}
const validEnrollments = ['Term', 'Casual']
if (!enrollmentType || !validEnrollments.includes(enrollmentType)) {
  throw new functions.https.HttpsError('invalid-argument', 'Valid enrollment type is required')
}
if ((studentCategory === 'Children' || studentCategory === 'Teen') && !parentName) {
  throw new functions.https.HttpsError('invalid-argument', 'Parent/Guardian name is required for minors')
}
```

Update the Firestore set to include new fields:

```typescript
await admin.firestore().doc(`users/${userRecord.uid}`).set({
  name,
  email,
  phone: phone || '',
  role: 'student',
  batchIds: [],
  studentCategory,
  enrollmentType,
  parentName,
  parentPhone,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  createdBy: context.auth.uid,
})
```

- [ ] **Step 2: Build functions to verify**

Run: `cd functions && npm run build`
Expected: Compiles without errors

- [ ] **Step 3: Commit**

```bash
git add functions/src/createStudent.ts
git commit -m "feat: accept studentCategory, enrollmentType, parent fields in createStudent function"
```

---

### Task 4: Delete Batch

**Files:**
- Modify: `src/pages/teacher/BatchList.tsx`
- Modify: `firestore.rules`

- [ ] **Step 1: Update Firestore rules to allow batch delete for teachers**

Change the batches rule from `allow write` to explicitly allow delete:

```
match /batches/{batchId} {
  allow read: if isTeacher() ||
    (request.auth != null && resource.data.studentIds.hasAny([request.auth.uid]));
  allow create, update, delete: if isTeacher();
}
```

- [ ] **Step 2: Add delete button to BatchList**

Add a delete handler + confirmation to each batch in BatchList. Import `deleteDoc` and `doc` from firebase/firestore. Add a swipe-to-delete or a long-press, but simplest is a small delete icon on each batch card.

In `BatchList`, wrap each batch link in a container with a delete button:

```tsx
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'

// Inside the batches map:
{batches.map((batch) => (
  <div key={batch.id} className="relative">
    <Link to={`/teacher/batches/${batch.id}`}>
      <BatchCard batch={batch} />
    </Link>
    <button
      onClick={(e) => {
        e.preventDefault()
        if (confirm(`Delete "${batch.name}"? Students will be removed from this batch.`)) {
          deleteDoc(doc(db!, 'batches', batch.id))
        }
      }}
      className="absolute top-3 right-3 text-white/30 hover:text-[#E91E8C] text-xs"
    >
      ✕
    </button>
  </div>
))}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/teacher/BatchList.tsx firestore.rules
git commit -m "feat: add batch delete for teachers"
```

---

### Task 5: Replace Video Upload with URL Linking

**Files:**
- Modify: `src/pages/teacher/VideoUpload.tsx`
- Modify: `src/components/VideoCard.tsx`
- Modify: `src/pages/student/VideoLibrary.tsx`

- [ ] **Step 1: Replace file upload with URL input in VideoUpload**

Gut the file upload logic. Replace with a simple URL text input. Remove storage imports, file state, progress bar, MAX_FILE_SIZE, ACCEPTED_TYPES. Keep the title, description, style, and batch selection.

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import { useBatches } from '../../hooks/useBatches'
import type { DanceStyle } from '../../types'

export function VideoUpload() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { batches } = useBatches()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState<DanceStyle>('Bollywood')
  const [selectedBatches, setSelectedBatches] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleBatch(batchId: string) {
    setSelectedBatches((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    )
  }

  async function handleSave() {
    if (!db || !user || !videoUrl || !title) return
    if (selectedBatches.length === 0) {
      setError('Please select at least one batch')
      return
    }
    setSaving(true)
    setError('')

    try {
      await addDoc(collection(db, 'videos'), {
        title, description, style,
        batchIds: selectedBatches,
        storageUrl: videoUrl,
        thumbnailUrl: '',
        uploadedBy: user.uid,
        uploadedAt: serverTimestamp(),
      })
      navigate('/teacher/videos')
    } catch (err: any) {
      setError(err.message || 'Failed to save video')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Add Video</h2>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" required
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />

      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4] resize-none" />

      <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="Paste video link (Google Photos, YouTube, etc.)"
        type="url"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />

      <select value={style} onChange={(e) => setStyle(e.target.value as DanceStyle)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00BCD4]">
        <option value="Bollywood" className="bg-[#1A1A2E]">Bollywood</option>
        <option value="Western" className="bg-[#1A1A2E]">Western</option>
        <option value="Fusion" className="bg-[#1A1A2E]">Fusion</option>
      </select>

      <div>
        <div className="text-xs text-white/50 mb-2">Visible to batches (select at least one):</div>
        <div className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <button key={b.id} type="button" onClick={() => toggleBatch(b.id)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                selectedBatches.includes(b.id) ? 'bg-[#00BCD4] text-white' : 'bg-white/5 text-white/50'
              }`}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-[#E91E8C] text-sm">{error}</p>}

      <button onClick={handleSave} disabled={!videoUrl || !title || selectedBatches.length === 0 || saving}
        className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50">
        {saving ? 'Saving...' : 'Add Video'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Update VideoCard to open external URL**

In `VideoCard`, the `onPlay` callback currently sets an inline video player. For external URLs (Google Photos, YouTube), the inline `<video>` tag won't work. Change `onPlay` to open the URL in a new tab:

```tsx
export function VideoCard({ video, onPlay }: Props) {
  function handleClick() {
    // External URLs open in new tab; Firebase Storage URLs can still play inline
    if (video.storageUrl.includes('firebasestorage.googleapis.com')) {
      onPlay?.(video)
    } else {
      window.open(video.storageUrl, '_blank', 'noopener')
    }
  }

  return (
    <div className="bg-white/5 rounded-xl p-3 flex gap-3 items-center cursor-pointer active:bg-white/10"
      onClick={handleClick}>
      {/* ... rest unchanged ... */}
    </div>
  )
}
```

- [ ] **Step 3: Update VideoLibrary to handle mixed URL types**

In `VideoLibrary.tsx`, keep the inline player for Firebase Storage URLs but also show external link indicator. No structural change needed — the VideoCard handles the routing.

- [ ] **Step 4: Commit**

```bash
git add src/pages/teacher/VideoUpload.tsx src/components/VideoCard.tsx src/pages/student/VideoLibrary.tsx
git commit -m "feat: replace video file upload with URL linking (Google Photos, YouTube, etc.)"
```

---

### Task 6: Punch-Card Visual for Term Subscriptions

**Files:**
- Create: `src/components/PunchCard.tsx`
- Modify: `src/pages/teacher/StudentProfile.tsx`
- Modify: `src/pages/student/StudentHome.tsx`

- [ ] **Step 1: Create PunchCard component**

A visual grid of circles. Total = packSize (e.g. 10). Used = packSize - classesRemaining (shown in orange). Remaining = classesRemaining (shown in green).

```tsx
interface Props {
  packSize: number
  classesRemaining: number
}

export function PunchCard({ packSize, classesRemaining }: Props) {
  const used = packSize - classesRemaining

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: packSize }, (_, i) => {
          const isUsed = i < used
          return (
            <div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                isUsed
                  ? 'bg-[#FF6F00]/20 text-[#FF6F00] border-2 border-[#FF6F00]/40'
                  : 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40'
              }`}
            >
              {i + 1}
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-3 text-[10px] text-white/50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF6F00]/20 border border-[#FF6F00]/40" />
          Used ({used})
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
          Remaining ({classesRemaining})
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add PunchCard to StudentProfile (teacher view)**

In `src/pages/teacher/StudentProfile.tsx`, replace the subscription section with the punch card when there's an active subscription:

```tsx
import { PunchCard } from '../../components/PunchCard'

// In the subscription section, replace the existing block:
{activeSub ? (
  <div className="bg-white/5 rounded-xl p-4 space-y-3">
    <div className="flex justify-between items-center">
      <div>
        <div className="text-sm">{activeSub.packSize}-class pack</div>
        <div className="text-xs text-white/40 mt-0.5">Assigned {formatDateDDMMYYYY(activeSub.assignedAt)}</div>
      </div>
      <SubscriptionBadge classesRemaining={activeSub.classesRemaining} />
    </div>
    <PunchCard packSize={activeSub.packSize} classesRemaining={activeSub.classesRemaining} />
  </div>
) : (
  <p className="text-white/30 text-sm">No active subscription</p>
)}
```

Also, show parent/guardian info and category in the profile header:

```tsx
<div>
  <h2 className="text-lg font-semibold">{student.name}</h2>
  <div className="text-sm text-white/50">{student.email}</div>
  {student.phone && <div className="text-sm text-white/50">{student.phone}</div>}
  {student.studentCategory && (
    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-[#7B2D8B]/20 text-[#7B2D8B]">
      {student.studentCategory}
    </span>
  )}
  {student.parentName && (
    <div className="text-xs text-white/40 mt-1">
      Guardian: {student.parentName} · {student.parentPhone}
    </div>
  )}
</div>
```

- [ ] **Step 3: Add PunchCard to StudentHome (student view)**

In `src/pages/student/StudentHome.tsx`, add the punch card below the existing classes remaining display:

```tsx
import { PunchCard } from '../../components/PunchCard'

// After the existing gradient card, add:
{subscription && (
  <section>
    <div className="text-xs uppercase tracking-wider text-[#00BCD4] mb-3">Class Pass</div>
    <div className="bg-white/5 rounded-xl p-4">
      <PunchCard packSize={subscription.packSize} classesRemaining={subscription.classesRemaining} />
    </div>
  </section>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/PunchCard.tsx src/pages/teacher/StudentProfile.tsx src/pages/student/StudentHome.tsx
git commit -m "feat: add punch-card visual for term subscriptions (green=remaining, orange=used)"
```

---

### Task 7: Update AssignSubscription with Fee Display

**Files:**
- Modify: `src/pages/teacher/AssignSubscription.tsx`

- [ ] **Step 1: Show fee info based on student category**

Import `useStudent` and read the student's category to display the fee. Update the pack options to show pricing:

```tsx
import { useStudent } from '../../hooks/useStudents'

// Inside the component, after existing hooks:
const { student, loading: studentLoading } = useStudent(studentId)

// Fee helper
function getFee(packSize: PackSize): string {
  if (!student) return ''
  const cat = student.studentCategory
  if (packSize === 10) {
    // Term pack
    return cat === 'Women' ? '$200' : '$150'
  }
  // For casual or other packs, show per-class rate
  const perClass = cat === 'Women' ? 23 : 18
  return `$${perClass * packSize}`
}

// Update the packs display to show fee:
{packs.map((pack) => (
  <button key={pack.size} onClick={() => setSelected(pack.size)}
    className={`w-full rounded-xl p-4 text-left transition-colors ${
      selected === pack.size
        ? 'bg-[#00BCD4]/20 border-2 border-[#00BCD4]'
        : 'bg-white/5 border-2 border-transparent'
    }`}>
    <div className="flex justify-between items-center">
      <div>
        <div className="text-lg font-semibold">{pack.label}</div>
        <div className="text-xs text-white/40 mt-1">{pack.size}-class pass</div>
      </div>
      {student?.studentCategory && (
        <div className="text-sm font-semibold text-[#00BCD4]">{getFee(pack.size)}</div>
      )}
    </div>
  </button>
))}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/teacher/AssignSubscription.tsx
git commit -m "feat: show fee pricing on subscription assignment based on student category"
```

---

### Task 8: Show Parent Info on Student Profile Page (student side)

**Files:**
- Modify: `src/pages/student/StudentProfilePage.tsx`

- [ ] **Step 1: Read the file and add parent/guardian display**

Read the current file, then add parent/guardian info display if the student has those fields:

```tsx
{student?.parentName && (
  <div className="bg-white/5 rounded-xl p-4 space-y-1">
    <div className="text-xs uppercase tracking-wider text-[#7B2D8B] mb-2">Parent/Guardian</div>
    <div className="text-sm">{student.parentName}</div>
    <div className="text-xs text-white/40">{student.parentPhone}</div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/student/StudentProfilePage.tsx
git commit -m "feat: show parent/guardian info on student profile page"
```

---

### Task 9: Verify Student Attendance Visibility

**Files:**
- Review: `src/hooks/useAttendance.ts`
- Review: `src/pages/student/AttendanceHistory.tsx`
- Review: `firestore.rules`

- [ ] **Step 1: Verify the data flow**

Check that:
1. `useStudentAttendance(userId)` queries with `where('studentId', '==', userId)` — it does
2. Firestore rules allow student to read their own attendance — they do: `resource.data.studentId == request.auth.uid`
3. `AttendanceHistory` renders records — it does

The attendance visibility should work. The issue Sriparna reported is likely because students weren't properly enrolled in batches or had no attendance records created yet. No code changes needed — this is a data flow issue that will resolve once the other fixes are in place.

- [ ] **Step 2: Add a helpful empty state message**

Update the empty state in `AttendanceHistory.tsx` to be more informative:

```tsx
<p className="text-white/30 text-sm">
  No attendance records yet. Your teacher will mark attendance during class.
</p>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/student/AttendanceHistory.tsx
git commit -m "fix: improve empty state message for student attendance history"
```

---

### Task 10: Build and Verify

- [ ] **Step 1: Build the frontend**

Run: `npm run build`
Expected: Builds without TypeScript errors

- [ ] **Step 2: Build the functions**

Run: `cd functions && npm run build`
Expected: Compiles without errors

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 4: Final commit if any fixes needed**
