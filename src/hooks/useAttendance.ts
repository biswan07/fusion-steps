import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'
import type { AttendanceRecord } from '../types'

function toRecord(id: string, data: any): AttendanceRecord {
  return { id, ...data, date: data.date?.toDate() || new Date(), createdAt: data.createdAt?.toDate() || new Date() }
}

export function useBatchAttendance(batchId: string | undefined) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !batchId) return
    const q = query(collection(db, 'attendance'), where('batchId', '==', batchId), orderBy('date', 'desc'), limit(100))
    const unsubscribe = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => toRecord(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [batchId])

  return { records, loading }
}

export function useStudentAttendance(studentId: string | undefined) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !studentId) return
    const q = query(collection(db, 'attendance'), where('studentId', '==', studentId), orderBy('date', 'desc'), limit(50))
    const unsubscribe = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => toRecord(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [studentId])

  return { records, loading }
}
