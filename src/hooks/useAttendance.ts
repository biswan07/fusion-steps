import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { AttendanceRecord } from '../types'

function toRecord(id: string, data: any): AttendanceRecord {
  return { id, ...data, date: data.date?.toDate() || new Date(), createdAt: data.createdAt?.toDate() || new Date() }
}

function sortByDateDesc(records: AttendanceRecord[]) {
  return records.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function useBatchAttendance(batchId: string | undefined) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !batchId) return
    const q = query(collection(db, 'attendance'), where('batchId', '==', batchId))
    const unsubscribe = onSnapshot(q, (snap) => {
      setRecords(sortByDateDesc(snap.docs.map((d) => toRecord(d.id, d.data()))))
      setLoading(false)
    }, (err) => {
      console.error('useBatchAttendance error:', err)
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
    const q = query(collection(db, 'attendance'), where('studentId', '==', studentId))
    const unsubscribe = onSnapshot(q, (snap) => {
      setRecords(sortByDateDesc(snap.docs.map((d) => toRecord(d.id, d.data()))))
      setLoading(false)
    }, (err) => {
      console.error('useStudentAttendance error:', err)
      setLoading(false)
    })
    return unsubscribe
  }, [studentId])

  return { records, loading }
}
