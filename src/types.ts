export type UserRole = 'teacher' | 'student'
export type DanceStyle = 'Bollywood' | 'Western' | 'Fusion'
export type BatchLevel = 'Beginner' | 'Intermediate' | 'Advanced'
export type AttendanceStatus = 'present' | 'absent'
export type PackSize = 1 | 5 | 10 | 20
export type StudentCategory = 'Children' | 'Teen' | 'Women'
export type EnrollmentType = 'Term' | 'Casual'

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
  studentCategory?: StudentCategory
  enrollmentType?: EnrollmentType
  parentName?: string
  parentPhone?: string
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
  isBackdated?: boolean
}

export type SubscriptionEditAction =
  | 'backdate-dates'
  | 'backdate-count'
  | 'resize'

export interface EditEntry {
  action: SubscriptionEditAction
  editedBy: string
  editedAt: Date
  oldValue: { packSize: PackSize; classesRemaining: number }
  newValue: { packSize: PackSize; classesRemaining: number }
  dates?: Date[]
  reason?: string
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
  editHistory?: EditEntry[]
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
