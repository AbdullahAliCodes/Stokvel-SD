import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { apiUrl } from '../utils/api'
import { btnPrimary, inputDark, labelDark } from '../ui'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const normalized = username
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
      if (normalized.length < 3 || normalized.length > 30) {
        throw new Error(
          'Username must be 3–30 characters (letters, numbers, underscore only).',
        )
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone_number: phoneNumber,
          },
        },
      })
      if (signUpError) throw signUpError

      if (data?.session?.access_token) {
        const res = await fetch(apiUrl('/api/profile/username'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ username: normalized }),
        })
        const text = await res.text()
        if (!res.ok) {
          let msg = text
          try {
            msg = JSON.parse(text).error || text
          } catch {
            /* keep text */
          }
          throw new Error(
            `Account created but username could not be saved: ${msg}. You can try again after signing in.`,
          )
        }
      }
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4 py-12">
      <div className="glass w-full max-w-md p-6 shadow-2xl shadow-black/40">
        <h1 className="mb-2 text-center text-xl font-bold uppercase tracking-widest text-cyan-400">
          Stokvel Portal
        </h1>
        <p className="mb-6 text-center text-xs text-slate-500">
          Management system — sign in to continue
        </p>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              isLogin
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
            onClick={() => {
              setIsLogin(true)
              setError(null)
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              !isLogin
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
            onClick={() => {
              setIsLogin(false)
              setError(null)
            }}
          >
            Sign Up
          </button>
        </div>

        {error ? (
          <p
            className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {isLogin ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <label className={labelDark}>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputDark}
              />
            </label>
            <label className={labelDark}>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputDark}
              />
            </label>
            <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
              {loading ? 'Loading…' : 'Log in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="flex flex-col gap-4">
            <label className={labelDark}>
              First Name
              <input
                type="text"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputDark}
              />
            </label>
            <label className={labelDark}>
              Last Name
              <input
                type="text"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputDark}
              />
            </label>
            <label className={labelDark}>
              Phone Number
              <input
                type="tel"
                autoComplete="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className={inputDark}
              />
            </label>
            <label className={labelDark}>
              Username
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputDark}
                placeholder="e.g. sipho_k"
              />
              <span className="mt-1 block text-xs text-slate-500">
                3–30 characters: lowercase letters, numbers, underscore. Saved via the server after
                signup.
              </span>
            </label>
            <label className={labelDark}>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputDark}
              />
            </label>
            <label className={labelDark}>
              Password
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputDark}
              />
            </label>
            <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
              {loading ? 'Loading…' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
