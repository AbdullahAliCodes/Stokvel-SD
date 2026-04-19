import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { supabase } from '../utils/supabase'
import { apiUrl } from '../utils/api'
import {
  authBrandAside,
  authFormSection,
  authPageWrap,
  authSplitCard,
  authTabActive,
  authTabGroup,
  authTabInactive,
  btnPrimary,
} from '../styles/tokens'
import { errorBox, inputLight, labelLight } from '../ui'

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

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (signInError) throw signInError
    } catch (err) {
      console.error('Google login error:', err)
      setError(err.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={authPageWrap}>
      <div className={authSplitCard}>
        <aside className={authBrandAside}>
          <div
            className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-emerald-400/15 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-teal-300/10 blur-2xl"
            aria-hidden
          />

          <div className="relative flex w-full max-w-md flex-col items-center">
            <BrandLogo
              to="/"
              variant="onDark"
              className="mx-auto"
              imgClassName="h-16 w-auto sm:h-20 md:h-24"
            />
            <p className="mt-6 text-xl font-semibold leading-snug text-white lg:text-2xl">
              Your circle, your savings — organised fairly.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100/85">
              Track contributions, meetings, and payouts in one place. Built for treasurers and
              members who want clarity without spreadsheet chaos.
            </p>
          </div>

          <p className="relative text-xs font-medium uppercase tracking-wider text-emerald-300/90">
            StokGeld · Member portal
          </p>
        </aside>

        <div className={authFormSection}>
          <div className="mx-auto w-full max-w-md">
            <h1 className="text-lg font-semibold text-emerald-950 md:text-xl">
              {isLogin ? 'Sign in' : 'Create your account'}
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              {isLogin
                ? 'Use your email and password to continue.'
                : 'Fill in your details — username is saved after signup via the server.'}
            </p>

            <div className={authTabGroup}>
              <button
                type="button"
                className={isLogin ? authTabActive : authTabInactive}
                onClick={() => {
                  setIsLogin(true)
                  setError(null)
                }}
              >
                Log in
              </button>
              <button
                type="button"
                className={!isLogin ? authTabActive : authTabInactive}
                onClick={() => {
                  setIsLogin(false)
                  setError(null)
                }}
              >
                Sign up
              </button>
            </div>

            {error ? (
              <p className={`${errorBox} mb-4`} role="alert">
                {error}
              </p>
            ) : null}

            {isLogin ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <label className={labelLight}>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputLight}
                  />
                </label>
                <label className={labelLight}>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputLight}
                  />
                </label>
                <button type="submit" disabled={loading} className={`${btnPrimary} w-full py-3`}>
                  {loading ? 'Loading…' : 'Log in'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="flex flex-col gap-4">
                <label className={labelLight}>
                  First Name
                  <input
                    type="text"
                    autoComplete="given-name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputLight}
                  />
                </label>
                <label className={labelLight}>
                  Last Name
                  <input
                    type="text"
                    autoComplete="family-name"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputLight}
                  />
                </label>
                <label className={labelLight}>
                  Phone Number
                  <input
                    type="tel"
                    autoComplete="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={inputLight}
                  />
                </label>
                <label className={labelLight}>
                  Username
                  <input
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputLight}
                    placeholder="e.g. sipho_k"
                  />
                  <span className="mt-1 block text-xs text-stone-500">
                    3–30 characters: lowercase letters, numbers, underscore. Saved via the server
                    after signup.
                  </span>
                </label>
                <label className={labelLight}>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputLight}
                  />
                </label>
                <label className={labelLight}>
                  Password
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputLight}
                  />
                </label>
                <button type="submit" disabled={loading} className={`${btnPrimary} w-full py-3`}>
                  {loading ? 'Loading…' : 'Create account'}
                </button>
              </form>
            )}

            <div className="mt-6 flex items-center justify-center">
              <div className="h-px w-full bg-stone-200"></div>
              <span className="whitespace-nowrap px-4 text-sm text-stone-500">Or continue with</span>
              <div className="h-px w-full bg-stone-200"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>

            <p className="mt-6 text-center text-sm text-stone-500">
              <Link to="/" className="font-medium text-emerald-800 hover:underline">
                ← Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
