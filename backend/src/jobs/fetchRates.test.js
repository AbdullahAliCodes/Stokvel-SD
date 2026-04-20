import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

const mockAxiosGet = jest.fn()
const mockUpdateMarketRates = jest.fn()

jest.unstable_mockModule('axios', () => ({
  default: {
    get: mockAxiosGet,
    isAxiosError: (err) => Boolean(err?.isAxiosError),
  },
}))

jest.unstable_mockModule('../services/marketDataService.js', () => ({
  updateMarketRates: mockUpdateMarketRates,
}))

const { fetchRepoRateFromFred } = await import('./fetchRates.js')

describe('fetchRepoRateFromFred', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    process.env = { ...originalEnv }
    delete process.env.FRED_API_KEY
    delete process.env.FRED_SA_POLICY_RATE_SERIES_ID
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    console.warn.mockRestore()
    console.error.mockRestore()
    console.log.mockRestore()
    process.env = originalEnv
  })

  // ==========================================
  // YOUR ORIGINAL TESTS
  // ==========================================
  
  it('skips when FRED_API_KEY is missing', async () => {
    await fetchRepoRateFromFred()

    expect(console.warn).toHaveBeenCalledWith(
      '[FRED] FRED_API_KEY not set; skipping rate fetch',
    )
    expect(mockAxiosGet).not.toHaveBeenCalled()
    expect(mockUpdateMarketRates).not.toHaveBeenCalled()
  })

  it('fetches latest rate and updates market_data', async () => {
    process.env.FRED_API_KEY = 'fred-key'
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: {
        observations: [{ date: '2026-04-01', value: '8.25' }],
      },
    })

    await fetchRepoRateFromFred()

    expect(mockAxiosGet).toHaveBeenCalledTimes(1)
    expect(mockUpdateMarketRates).toHaveBeenCalledWith(8.25)
    expect(console.log).toHaveBeenCalledWith(
      '[FRED] Policy rate IRSTCB01ZAM156N (2026-04-01): 8.25% → updating market_data',
    )
  })

  it('logs fetch failure and does not update when observation is unusable', async () => {
    process.env.FRED_API_KEY = 'fred-key'
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: {
        observations: [{ date: '2026-04-01', value: '.' }],
      },
    })

    await fetchRepoRateFromFred()

    expect(mockUpdateMarketRates).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      '[FRED] Rate fetch failed:',
      'FRED returned no usable observation',
    )
  })

  it('separately logs Supabase write failures after a successful fetch', async () => {
    process.env.FRED_API_KEY = 'fred-key'
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: {
        observations: [{ date: '2026-04-01', value: '8.25' }],
      },
    })
    mockUpdateMarketRates.mockRejectedValue(new Error('write failed'))

    await fetchRepoRateFromFred()

    expect(mockUpdateMarketRates).toHaveBeenCalledWith(8.25)
    expect(console.error).toHaveBeenCalledWith(
      '[FRED] Supabase market_data update failed:',
      'write failed',
    )
  })

  it('retries on HTTP 500 then succeeds', async () => {
    jest.useFakeTimers()
    process.env.FRED_API_KEY = 'fred-key'
    mockAxiosGet
      .mockResolvedValueOnce({
        status: 500,
        data: { message: 'temporary issue' },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          observations: [{ date: '2026-04-01', value: '8.25' }],
        },
      })

    const run = fetchRepoRateFromFred()
    await jest.runAllTimersAsync()
    await run

    expect(mockAxiosGet).toHaveBeenCalledTimes(2)
    expect(mockUpdateMarketRates).toHaveBeenCalledWith(8.25)
    expect(console.warn).toHaveBeenCalledWith(
      '[FRED] attempt 1/3 HTTP 500, retrying… {"message":"temporary issue"}',
    )
  })

  // ==========================================
  // NEW EDGE CASE TESTS (For 100% Coverage)
  // ==========================================

  // --- 1. Custom Series ID ---
  it('uses custom series ID if FRED_SA_POLICY_RATE_SERIES_ID is set', async () => {
    process.env.FRED_API_KEY = 'fred-key'
    process.env.FRED_SA_POLICY_RATE_SERIES_ID = 'CUSTOM_SERIES'
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: { observations: [{ date: '2026-04-01', value: '8.25' }] },
    })

    await fetchRepoRateFromFred()

    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({ series_id: 'CUSTOM_SERIES' })
      })
    )
  })

  // --- 2. Parse Validation Failures ---
  it('throws invalid rate when value cannot be parsed to a finite number', async () => {
    process.env.FRED_API_KEY = 'fred-key'
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: { observations: [{ date: '2026-04-01', value: 'abc' }] },
    })

    await fetchRepoRateFromFred()

    expect(console.error).toHaveBeenCalledWith(
      '[FRED] Rate fetch failed:',
      'Invalid rate from FRED: abc'
    )
  })

  it('throws when observations array is missing or empty', async () => {
    process.env.FRED_API_KEY = 'fred-key'
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: { observations: [] }, // Empty array
    })

    await fetchRepoRateFromFred()

    expect(console.error).toHaveBeenCalledWith(
      '[FRED] Rate fetch failed:',
      'FRED returned no usable observation'
    )
  })

  // --- 3. Axios Network Errors & Retries ---
  it('retries on Axios network errors (no response) and warns', async () => {
    jest.useFakeTimers()
    process.env.FRED_API_KEY = 'fred-key'
    const netError = new Error('Network Error')
    netError.isAxiosError = true
    netError.code = 'ECONNABORTED' // No err.response attached

    mockAxiosGet
      .mockRejectedValueOnce(netError)
      .mockResolvedValueOnce({
        status: 200,
        data: { observations: [{ date: '2026-04-01', value: '8.00' }] },
      })

    const run = fetchRepoRateFromFred()
    await jest.runAllTimersAsync()
    await run

    expect(mockAxiosGet).toHaveBeenCalledTimes(2)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('network error (ECONNABORTED), retrying')
    )
    expect(mockUpdateMarketRates).toHaveBeenCalledWith(8)
  })

  it('handles Axios errors with an HTTP response in the outer catch block', async () => {
    process.env.FRED_API_KEY = 'fred-key'
    const authErr = new Error('Forbidden')
    authErr.isAxiosError = true
    authErr.response = { status: 403, data: 'Invalid API Key' }
    mockAxiosGet.mockRejectedValue(authErr)

    await fetchRepoRateFromFred()

    expect(console.error).toHaveBeenCalledWith(
      '[FRED] Request failed:',
      'Forbidden',
      'HTTP 403',
      'body: Invalid API Key'
    )
  })

  // --- 4. Exhausted Retries (Fallback Error) ---
  it('exhausts retries on HTTP 429 and hits fallback exhausted error', async () => {
    jest.useFakeTimers()
    process.env.FRED_API_KEY = 'fred-key'
    // 429 triggers `continue` loop, eventually breaking out of the MAX_ATTEMPTS natively
    mockAxiosGet.mockResolvedValue({ status: 429, data: 'Rate Limited' })

    const run = fetchRepoRateFromFred()
    await jest.runAllTimersAsync()
    await run

    expect(mockAxiosGet).toHaveBeenCalledTimes(3)
    expect(console.warn).toHaveBeenCalledTimes(3)
    expect(console.error).toHaveBeenCalledWith(
      '[FRED] Rate fetch failed:',
      'FRED: exhausted retries'
    )
  })

  it('truncates very long FRED response bodies (summarizeFredBody maxLen)', async () => {
    process.env.FRED_API_KEY = 'fred-key'
    const longBody = 'A'.repeat(500)
    mockAxiosGet.mockResolvedValue({ status: 400, data: longBody })

    await fetchRepoRateFromFred()

    expect(console.error).toHaveBeenCalledWith(
      '[FRED] Rate fetch failed:',
      expect.stringContaining('FRED HTTP 400: ' + 'A'.repeat(400) + '…')
    )
  })

  // --- 5. String Errors (instanceof Error checks) ---
  it('handles thrown string errors (non-Error objects) in fetch catch', async () => {
    process.env.FRED_API_KEY = 'fred-key'
    mockAxiosGet.mockRejectedValue('Just a string error')

    await fetchRepoRateFromFred()

    expect(console.error).toHaveBeenCalledWith(
      '[FRED] Rate fetch failed:',
      'Just a string error'
    )
  })

  it('handles thrown string errors (non-Error objects) in Supabase catch', async () => {
    process.env.FRED_API_KEY = 'fred-key'
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: { observations: [{ date: '2026-04-01', value: '8.25' }] },
    })
    mockUpdateMarketRates.mockRejectedValue('String DB error')

    await fetchRepoRateFromFred()

    expect(console.error).toHaveBeenCalledWith(
      '[FRED] Supabase market_data update failed:',
      'String DB error'
    )
  })
})