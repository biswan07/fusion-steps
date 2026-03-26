import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Batch } from '../types'

function toBatch(id: string, data: any): Batch {
  return { id, ...data, createdAt: data.createdAt?.toDate() || new Date() }
}

const dayOrder: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7,
}

export function useBatches(activeOnly = true) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) return
    const constraints = activeOnly ? [where('isActive', '==', true)] : []
    const q = query(collection(db, 'batches'), ...constraints)
    const unsubscribe = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => toBatch(d.id, d.data()))
      items.sort((a, b) => (dayOrder[a.dayOfWeek] || 8) - (dayOrder[b.dayOfWeek] || 8))
      setBatches(items)
      setLoading(false)
    }, (err) => {
      console.error('useBatches error:', err)
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
    if (!db || !batchId) {
      setBatch(null)
      setLoading(false)
      return
    }
    const unsubscribe = onSnapshot(doc(db, 'batches', batchId), (snap) => {
      setBatch(snap.exists() ? toBatch(snap.id, snap.data()) : null)
      setLoading(false)
    }, (err) => {
      console.error('useBatch error:', err)
      setLoading(false)
    })
    return unsubscribe
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
    }, (err) => {
      console.error('useStudentBatches error:', err)
      setLoading(false)
    })
    return unsubscribe
  }, [batchIds.join(',')])

  return { batches, loading }
}
