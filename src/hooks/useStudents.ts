import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, orderBy } from 'firebase/firestore'
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
