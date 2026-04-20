import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

// --- 1. Mock Dependencies ---
const mockSupabaseChain = {
  select: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
}

const mockSupabaseClient = {
  from: jest.fn().mockReturnValue(mockSupabaseChain),
}

const mockGetServiceSupabase = jest.fn()

jest.unstable_mockModule('../utils/supabaseAdmin.js', () => ({
  getServiceSupabase: mockGetServiceSupabase,
}))

// Dynamically import the module after mocking
const {
  calculateProjectedGrowth,
  getMarketRates,
  updateMarketRates,
} = await import('./marketDataService.js')

describe('Market Data Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: return a valid client
    mockGetServiceSupabase.mockReturnValue(mockSupabaseClient)
  })

  // ==========================================
  // calculateProjectedGrowth()
  // ==========================================
  describe('calculateProjectedGrowth', () => {
    it('calculates the future value of an ordinary annuity correctly', () => {
      // 100 per month, 12% annual, for 12 months
      // r = 0.01, n = 12
      // FV = 100 * ((1.01^12 - 1) / 0.01) = ~1268.25
      const result = calculateProjectedGrowth(100, 12, 12)
      expect(result).toBe(1268.25)
    })

    it('returns 0 if months is 0 or negative', () => {
      expect(calculateProjectedGrowth(100, 10, 0)).toBe(0)
      expect(calculateProjectedGrowth(100, 10, -5)).toBe(0)
    })

    it('handles 0% interest rate without dividing by zero', () => {
      // 100 * 12 = 1200
      expect(calculateProjectedGrowth(100, 0, 12)).toBe(1200)
    })

    it('throws an error if arguments are not finite numbers', () => {
      expect(() => calculateProjectedGrowth('abc', 10, 12)).toThrow('invalid numeric arguments')
      expect(() => calculateProjectedGrowth(100, NaN, 12)).toThrow('invalid numeric arguments')
      // FIX: Changed from null to undefined
      expect(() => calculateProjectedGrowth(100, 10, undefined)).toThrow('invalid numeric arguments')
    })
  })

  // ==========================================
  // Client Requirement Checks
  // ==========================================
  describe('requireServiceClient fallback', () => {
    it('throws an error if Supabase service client is not configured', async () => {
      mockGetServiceSupabase.mockReturnValue(null) // Simulate missing client

      await expect(getMarketRates()).rejects.toThrow(
        'SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL) must be set for market data updates'
      )
    })
  })

  // ==========================================
  // getMarketRates()
  // ==========================================
  describe('getMarketRates', () => {
    it('fetches and maps valid market rates correctly', async () => {
      mockSupabaseChain.select.mockResolvedValueOnce({
        error: null,
        data: [
          { rate_type: 'repo', value: '8.25', last_updated: '2026-04-01T00:00:00Z' },
          { rate_type: 'prime', value: 11.75, last_updated: '2026-04-01T00:00:00Z' },
        ],
      })

      const rates = await getMarketRates()

      expect(rates).toEqual({
        repo: { value: 8.25, last_updated: '2026-04-01T00:00:00Z' },
        prime: { value: 11.75, last_updated: '2026-04-01T00:00:00Z' },
      })
    })

    it('skips rows with invalid data (nulls, missing types, unparseable strings)', async () => {
      mockSupabaseChain.select.mockResolvedValueOnce({
        error: null,
        data: [
          { rate_type: 'valid', value: '5', last_updated: '2026-04-01T00:00:00Z' },
          { rate_type: 'bad_value', value: 'abc', last_updated: '2026-04-01T00:00:00Z' }, // Invalid value
          { value: 10, last_updated: '2026-04-01T00:00:00Z' }, // Missing rate_type
          { rate_type: 'no_date', value: 5 }, // Missing last_updated
        ],
      })

      const rates = await getMarketRates()

      // Only the perfectly valid row should make it through
      expect(Object.keys(rates)).toHaveLength(1)
      expect(rates.valid.value).toBe(5)
    })

    it('returns an empty object if data is null', async () => {
      mockSupabaseChain.select.mockResolvedValueOnce({ error: null, data: null })
      const rates = await getMarketRates()
      expect(rates).toEqual({})
    })

    it('throws an error if the database query fails', async () => {
      mockSupabaseChain.select.mockResolvedValueOnce({
        error: { message: 'Database connection failed' },
        data: null,
      })

      await expect(getMarketRates()).rejects.toThrow('Failed to fetch market rates: Database connection failed')
    })
  })

  // ==========================================
  // updateMarketRates()
  // ==========================================
  describe('updateMarketRates', () => {
    beforeEach(() => {
      // Use fake timers to mock the new Date().toISOString() call
      jest.useFakeTimers().setSystemTime(new Date('2026-04-20T12:00:00Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('updates repo and prime rates successfully (calculates prime spread)', async () => {
      // Mock successful DB updates
      mockSupabaseChain.eq.mockResolvedValue({ error: null })

      await updateMarketRates(8.25) // Repo is 8.25, Prime should be 11.75 (+3.5)

      // Verify the Repo update call
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('market_data')
      expect(mockSupabaseChain.update).toHaveBeenCalledWith({
        value: 8.25,
        last_updated: '2026-04-20T12:00:00.000Z',
      })
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('rate_type', 'repo')

      // Verify the Prime update call
      expect(mockSupabaseChain.update).toHaveBeenCalledWith({
        value: 11.75, // 8.25 + 3.5
        last_updated: '2026-04-20T12:00:00.000Z',
      })
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('rate_type', 'prime')
    })

    it('accepts string numbers and parses them correctly', async () => {
      mockSupabaseChain.eq.mockResolvedValue({ error: null })

      await updateMarketRates('7.00') // Prime should be 10.5

      expect(mockSupabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ value: 7 })
      )
      expect(mockSupabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ value: 10.5 })
      )
    })

    it('throws an error if repoRate cannot be parsed as a number', async () => {
      await expect(updateMarketRates('invalid')).rejects.toThrow(
        'updateMarketRates: repoRate must be a finite number'
      )
      // FIX: Changed from null to undefined
      await expect(updateMarketRates(undefined)).rejects.toThrow(
        'updateMarketRates: repoRate must be a finite number'
      )
    })

    it('throws an error if the repo rate database update fails', async () => {
      // Mock the first eq() call (repo) to fail
      mockSupabaseChain.eq.mockResolvedValueOnce({ error: { message: 'Repo Update Error' } })

      await expect(updateMarketRates(8.25)).rejects.toThrow(
        'Failed to update repo rate: Repo Update Error'
      )
    })

    it('throws an error if the prime rate database update fails', async () => {
      // Mock first eq() (repo) to succeed, but second eq() (prime) to fail
      mockSupabaseChain.eq
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'Prime Update Error' } })

      await expect(updateMarketRates(8.25)).rejects.toThrow(
        'Failed to update prime rate: Prime Update Error'
      )
    })
  })
})