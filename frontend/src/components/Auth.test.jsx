import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Auth from './Auth'

const {
  signInWithPasswordMock,
  signUpMock,
  signInWithOAuthMock,
  apiUrlMock,
} = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  signUpMock: vi.fn(),
  signInWithOAuthMock: vi.fn(),
  apiUrlMock: vi.fn((path) => path),
}))

vi.mock('./BrandLogo', () => ({
  default: () => <div data-testid="brand-logo">BrandLogo</div>,
}))

vi.mock('../utils/api', () => ({
  apiUrl: apiUrlMock,
}))

vi.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      signInWithOAuth: signInWithOAuthMock,
    },
  },
}))

function renderAuth() {
  return render(
    <MemoryRouter>
      <Auth />
    </MemoryRouter>,
  )
}

async function fillLoginForm(user, { email = 'user@example.com', password = 'pass1234' } = {}) {
  const emailInput = screen.getByLabelText('Email')
  const passwordInput = screen.getByLabelText('Password')
  await user.clear(emailInput)
  await user.type(emailInput, email)
  await user.clear(passwordInput)
  await user.type(passwordInput, password)
}

function getLoginSubmitButton() {
  const passwordInput = screen.getByLabelText('Password')
  const form = passwordInput.closest('form')
  return within(form).getByRole('button', { name: 'Log in' })
}

async function switchToSignUp(user) {
  await user.click(screen.getByRole('button', { name: 'Sign up' }))
}

async function fillSignupForm(
  user,
  {
    firstName = 'Ada',
    lastName = 'Lovelace',
    phoneNumber = '0710000000',
    username = 'Ada _ 123!',
    email = 'ada@example.com',
    password = 'pass1234',
  } = {},
) {
  await user.type(screen.getByLabelText('First Name'), firstName)
  await user.type(screen.getByLabelText('Last Name'), lastName)
  await user.type(screen.getByLabelText('Phone Number'), phoneNumber)
  await user.type(screen.getByPlaceholderText('e.g. sipho_k'), username)
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
}

describe('Auth', { timeout: 15000 }, () => {
  beforeEach(() => {
    // Some other suites use fake timers; ensure user-event runs on real timers here.
    vi.useRealTimers()
    signInWithPasswordMock.mockReset()
    signUpMock.mockReset()
    signInWithOAuthMock.mockReset()
    apiUrlMock.mockClear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('logs in successfully with email and password', async () => {
    const user = userEvent.setup()
    signInWithPasswordMock.mockResolvedValue({ error: null })

    renderAuth()
    await fillLoginForm(user)
    await user.click(getLoginSubmitButton())

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'pass1234',
      })
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows login error message when Supabase sign-in fails', async () => {
    const user = userEvent.setup()
    signInWithPasswordMock.mockResolvedValue({ error: { message: 'Invalid credentials' } })

    renderAuth()
    await fillLoginForm(user)
    await user.click(getLoginSubmitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials')
  })

  it('validates username length after normalization and skips signup request when invalid', async () => {
    const user = userEvent.setup()

    renderAuth()
    await switchToSignUp(user)
    await fillSignupForm(user, { username: '__' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Username must be 3–30 characters (letters, numbers, underscore only).',
    )
    expect(signUpMock).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces Supabase signup errors', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({ data: null, error: { message: 'Email already exists' } })

    renderAuth()
    await switchToSignUp(user)
    await fillSignupForm(user, { username: 'valid_name' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already exists')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('creates account and saves normalized username when session token exists', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      data: { session: { access_token: 'access-token' } },
      error: null,
    })
    fetch.mockResolvedValue({
      ok: true,
      text: async () => '',
    })

    renderAuth()
    await switchToSignUp(user)
    await fillSignupForm(user, { username: 'Ada Name 42!' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    expect(apiUrlMock).toHaveBeenCalledWith('/api/profile/username')
    expect(fetch).toHaveBeenCalledWith('/api/profile/username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({ username: 'ada_name_42' }),
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('handles profile username API errors with JSON payload message', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      data: { session: { access_token: 'access-token' } },
      error: null,
    })
    fetch.mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: 'Username already taken' }),
    })

    renderAuth()
    await switchToSignUp(user)
    await fillSignupForm(user, { username: 'valid_name' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Account created but username could not be saved: Username already taken. You can try again after signing in.',
    )
  })

  it('handles profile username API errors with plain-text payload fallback', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      data: { session: { access_token: 'access-token' } },
      error: null,
    })
    fetch.mockResolvedValue({
      ok: false,
      text: async () => 'Server unavailable',
    })

    renderAuth()
    await switchToSignUp(user)
    await fillSignupForm(user, { username: 'valid_name' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Account created but username could not be saved: Server unavailable. You can try again after signing in.',
    )
  })

  it('does not call profile username API when signup returns no session token', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    renderAuth()
    await switchToSignUp(user)
    await fillSignupForm(user, { username: 'valid_name' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1)
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('starts Google OAuth login with current origin redirect', async () => {
    const user = userEvent.setup()
    signInWithOAuthMock.mockResolvedValue({ error: null })

    renderAuth()
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows fallback stringified error for Google OAuth failures', async () => {
    const user = userEvent.setup()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    signInWithOAuthMock.mockRejectedValue('OAuth unavailable')

    renderAuth()
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('OAuth unavailable')
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('clears any existing error when switching back to login tab', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({ data: null, error: { message: 'Email already exists' } })

    renderAuth()
    await switchToSignUp(user)
    await fillSignupForm(user, { username: 'valid_name' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already exists')

    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
