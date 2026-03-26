import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'

export function LoginPage() {
  const [email, setEmail] = useState('')
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
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid))
      const role = userDoc.data()?.role
      if (role === 'teacher') {
        navigate('/teacher/dashboard', { replace: true })
      } else {
        navigate('/student/home', { replace: true })
      }
    } catch {
      setError('Invalid email or password')
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
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00BCD4]" />
        {error && <p className="text-[#E91E8C] text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-[#FF6F00] text-white font-semibold rounded-xl py-3 disabled:opacity-50">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
