import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'

/** Convert a phone number to the synthetic Firebase email used for phone-based accounts */
function phoneToEmail(input: string): string {
  const digits = input.replace(/\D/g, '')
  return `phone_${digits}@fusionsteps.app`
}

/** Returns true if the input looks like a phone number (no @ sign, has digits, no letters other than + ) */
function isPhoneInput(input: string): boolean {
  return !input.includes('@') && /\d/.test(input)
}

export function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!auth || !db) return
    setLoading(true)
    setError('')
    try {
      const email = isPhoneInput(identifier) ? phoneToEmail(identifier) : identifier.trim()
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid))
      const role = userDoc.data()?.role
      if (role === 'teacher') {
        navigate('/teacher/dashboard', { replace: true })
      } else {
        navigate('/student/home', { replace: true })
      }
    } catch {
      setError('Invalid email/phone or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <img src="/assets/logo.png" alt="Fusion Steps" className="w-28 h-28 rounded-full mb-4" />
      <h1 className="font-['Dancing_Script'] text-3xl text-[#00BCD4] mb-1">Fusion Steps</h1>
      <p className="text-white/50 text-sm mb-8">by Sriparna Dutta</p>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input
          type="text"
          placeholder="Email or Phone Number"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoComplete="username"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]"
        />
        {error && <p className="text-[#E91E8C] text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
