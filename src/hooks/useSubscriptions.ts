import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { Subscription } from '../types'

function toSub(id: string, data: any): Subscription {
  return { id, ...data, assignedAt: data.assignedAt?.toDate() || new Date() }
}

export function useActiveSubscription(studentId: string | undefined) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !studentId) {
      setSubscription(null)
      setLoading(false)
      return
    }
    const q = query(
      collection(db, 'subscriptions'),
      where('studentId', '==', studentId),
      where('isActive', '==', true)
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      // FIFO: oldest active subscription first
      const subs = snap.docs.map((d) => toSub(d.id, d.data()))
      subs.sort((a, b) => a.assignedAt.getTime() - b.assignedAt.getTime())
      setSubscription(subs[0] || null)
      setLoading(false)
    }, (err) => {
      console.error('useActiveSubscription error:', err)
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
    const q = query(collection(db, 'subscriptions'), where('studentId', '==', studentId))
    const unsubscribe = onSnapshot(q, (snap) => {
      const subs = snap.docs.map((d) => toSub(d.id, d.data()))
      subs.sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime())
      setSubscriptions(subs)
      setLoading(false)
    }, (err) => {
      console.error('useStudentSubscriptions error:', err)
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
    }, (err) => {
      console.error('useLowBalanceStudents error:', err)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return { subscriptions, loading }
}
