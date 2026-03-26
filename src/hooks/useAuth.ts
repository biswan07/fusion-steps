import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import type { UserRole } from '../types'

export interface AuthState {
  user: User | null
  role: UserRole | null
  loading: boolean
}

export const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthProvider(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
  })

  useEffect(() => {
    if (!auth) {
      setState({ user: null, role: null, loading: false })
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && db) {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const role = (userDoc.data()?.role as UserRole) || null
        setState({ user, role, loading: false })
      } else {
        setState({ user: null, role: null, loading: false })
      }
    })

    return unsubscribe
  }, [])

  return state
}
