import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiUrl } from './api'

describe('apiUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns relative path when base URL is not set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')

    expect(apiUrl('/api/health')).toBe('/api/health')
    expect(apiUrl('api/health')).toBe('/api/health')
  })

  it('joins configured base URL and path without duplicate slash', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/')

    expect(apiUrl('/api/health')).toBe('https://api.example.com/api/health')
    expect(apiUrl('api/users')).toBe('https://api.example.com/api/users')
  })
})
