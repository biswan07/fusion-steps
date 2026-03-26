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
