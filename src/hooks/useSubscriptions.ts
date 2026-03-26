import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import type { Subscription } from '../types'

function toSub(id: string, data: any): Subscription {
  return { id, ...data, assignedAt: data.assignedAt?.toDate() || new Date() }
}

export function useActiveSubscription(studentId: string | undefined) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !studentId) return
    const q = query(
      collection(db, 'subscriptions'),
      where('studentId', '==', studentId),
      where('isActive', '==', true),
      orderBy('assignedAt', 'asc')
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      // FIFO: oldest active subscription first
      const subs = snap.docs.map((d) => toSub(d.id, d.data()))
      setSubscription(subs[0] || null)
      setLoading(false)
    })
    return unsubscribe
  }, [studentId])

  return { subscription, loading }
}

export function useStudentSubscriptions(studentId: string | undefined) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !studentId) return
    const q = query(collection(db, 'subscriptions'), where('studentId', '==', studentId), orderBy('assignedAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snap) => {
      setSubscriptions(snap.docs.map((d) => toSub(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [studentId])

  return { subscriptions, loading }
}

export function useLowBalanceStudents() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) return
    const q = query(
      collection(db, 'subscriptions'),
      where('isActive', '==', true),
      where('classesRemaining', '<=', 2)
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setSubscriptions(snap.docs.map((d) => toSub(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return { subscriptions, loading }
}
