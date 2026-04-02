import { useState } from 'react'
import { supabase } from '../utils/supabase'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
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
      const { error: signUpError } = await supabase.auth.signUp({
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
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4 text-black">
      <div className="w-full max-w-md border border-black bg-white p-4">
        <h1 className="mb-4 border-b border-black pb-2 text-xl font-semibold">
          Stokvel Management System
        </h1>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`flex-1 border px-4 py-2 ${
              isLogin
                ? 'border-black bg-black text-white'
                : 'border-black bg-white text-black hover:bg-gray-100'
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
            className={`flex-1 border px-4 py-2 ${
              !isLogin
                ? 'border-black bg-black text-white'
                : 'border-black bg-white text-black hover:bg-gray-100'
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
          <p className="mb-4 font-bold text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {isLogin ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-left text-sm">
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-black bg-white p-2 text-black"
              />
            </label>
            <label className="flex flex-col gap-1 text-left text-sm">
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border border-black bg-white p-2 text-black"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Log in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-left text-sm">
              First Name
              <input
                type="text"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="border border-black bg-white p-2 text-black"
              />
            </label>
            <label className="flex flex-col gap-1 text-left text-sm">
              Last Name
              <input
                type="text"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="border border-black bg-white p-2 text-black"
              />
            </label>
            <label className="flex flex-col gap-1 text-left text-sm">
              Phone Number
              <input
                type="tel"
                autoComplete="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="border border-black bg-white p-2 text-black"
              />
            </label>
            <label className="flex flex-col gap-1 text-left text-sm">
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-black bg-white p-2 text-black"
              />
            </label>
            <label className="flex flex-col gap-1 text-left text-sm">
              Password
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border border-black bg-white p-2 text-black"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
