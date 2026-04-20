import request from 'supertest'
import express from 'express'
import { jest, describe, it, expect, beforeEach } from '@jest/globals'

const mockGetMarketRates = jest.fn()
const mockCalculateProjectedGrowth = jest.fn()

jest.unstable_mockModule('../services/marketDataService.js', () => ({
  getMarketRates: mockGetMarketRates,
  calculateProjectedGrowth: mockCalculateProjectedGrowth,
}))

const { default: marketRatesRouter } = await import('./marketRates.js')

function makeApp() {
  const app = express()
  app.use('/api/market-rates', marketRatesRouter)
  return app
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('Market rates router', () => {
  describe('GET /api/market-rates', () => {
    it('returns current market rates when repo and prime values exist', async () => {
      mockGetMarketRates.mockResolvedValue({
        repo: { value: 8.25, last_updated: '2026-04-20T10:00:00Z' },
        prime: { value: 11.75, last_updated: '2026-04-20T10:00:00Z' },
      })

      const app = makeApp()
      const res = await request(app).get('/api/market-rates')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        repo_rate: 8.25,
        prime_rate: 11.75,
        last_updated: '2026-04-20T10:00:00Z',
      })
    })

    it('returns 503 when repo rate is missing', async () => {
      mockGetMarketRates.mockResolvedValue({
        repo: null,
        prime: { value: 11.75, last_updated: '2026-04-20T10:00:00Z' },
      })

      const app = makeApp()
      const res = await request(app).get('/api/market-rates')

      expect(res.status).toBe(503)
      expect(res.body).toEqual({ error: 'Market rates not available yet' })
    })

    it('returns 503 when prime rate is missing', async () => {
      mockGetMarketRates.mockResolvedValue({
        repo: { value: 8.25, last_updated: '2026-04-20T10:00:00Z' },
        prime: null,
      })

      const app = makeApp()
      const res = await request(app).get('/api/market-rates')

      expect(res.status).toBe(503)
      expect(res.body).toEqual({ error: 'Market rates not available yet' })
    })

    it('returns 500 when getMarketRates throws', async () => {
      mockGetMarketRates.mockRejectedValue(new Error('Service failed'))

      const app = makeApp()
      const res = await request(app).get('/api/market-rates')

      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'Could not retrieve market rates' })
    })
  })

  describe('GET /api/market-rates/projection', () => {
    it('returns 400 when contribution query is missing', async () => {
      const app = makeApp()
      const res = await request(app).get('/api/market-rates/projection')

      expect(res.status).toBe(400)
      expect(res.body).toEqual({
        error: 'Query "contribution" must be a positive number',
      })
    })

    it('returns 400 when contribution is zero or negative', async () => {
      const app = makeApp()
      const res = await request(app).get('/api/market-rates/projection?contribution=0')

      expect(res.status).toBe(400)
      expect(res.body).toEqual({
        error: 'Query "contribution" must be a positive number',
      })
    })

    it('returns 400 when contribution is not numeric', async () => {
      const app = makeApp()
      const res = await request(app).get('/api/market-rates/projection?contribution=abc')

      expect(res.status).toBe(400)
      expect(res.body).toEqual({
        error: 'Query "contribution" must be a positive number',
      })
    })

    it('defaults months=0 to 12 and returns projection', async () => {
      mockGetMarketRates.mockResolvedValue({
        repo: { value: 8.25, last_updated: '2026-04-20T10:00:00Z' },
        prime: { value: 11.75, last_updated: '2026-04-20T10:00:00Z' },
      })
      mockCalculateProjectedGrowth.mockReturnValue(12650)

      const app = makeApp()
      const res = await request(app).get('/api/market-rates/projection?contribution=1000&months=0')

      expect(mockCalculateProjectedGrowth).toHaveBeenCalledWith(1000, 11.75, 12)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        monthly_contribution: 1000,
        months: 12,
        rate_used: 11.75,
        projected_value: 12650,
      })
    })

    it('returns 400 when months is above maximum', async () => {
      const app = makeApp()
      const res = await request(app).get('/api/market-rates/projection?contribution=1000&months=601')

      expect(res.status).toBe(400)
      expect(res.body).toEqual({
        error: 'Query "months" must be between 1 and 600',
      })
    })

    it('defaults non-numeric months to 12 and returns projection', async () => {
      mockGetMarketRates.mockResolvedValue({
        repo: { value: 8.25, last_updated: '2026-04-20T10:00:00Z' },
        prime: { value: 11.75, last_updated: '2026-04-20T10:00:00Z' },
      })
      mockCalculateProjectedGrowth.mockReturnValue(12650)

      const app = makeApp()
      const res = await request(app).get('/api/market-rates/projection?contribution=1000&months=abc')

      expect(mockCalculateProjectedGrowth).toHaveBeenCalledWith(1000, 11.75, 12)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        monthly_contribution: 1000,
        months: 12,
        rate_used: 11.75,
        projected_value: 12650,
      })
    })

    it('defaults months to 12 when months is omitted', async () => {
      mockGetMarketRates.mockResolvedValue({
        repo: { value: 8.25, last_updated: '2026-04-20T10:00:00Z' },
        prime: { value: 11.75, last_updated: '2026-04-20T10:00:00Z' },
      })
      mockCalculateProjectedGrowth.mockReturnValue(12650)

      const app = makeApp()
      const res = await request(app).get('/api/market-rates/projection?contribution=1000')

      expect(mockCalculateProjectedGrowth).toHaveBeenCalledWith(1000, 11.75, 12)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        monthly_contribution: 1000,
        months: 12,
        rate_used: 11.75,
        projected_value: 12650,
      })
    })

    it('returns 503 when prime rate is missing for projection', async () => {
      mockGetMarketRates.mockResolvedValue({
        repo: { value: 8.25, last_updated: '2026-04-20T10:00:00Z' },
        prime: null,
      })

      const app = makeApp()
      const res = await request(app).get('/api/market-rates/projection?contribution=500&months=24')

      expect(res.status).toBe(503)
      expect(res.body).toEqual({ error: 'Market rates not available yet' })
    })

    it('returns projected growth with explicit months', async () => {
      mockGetMarketRates.mockResolvedValue({
        repo: { value: 8.25, last_updated: '2026-04-20T10:00:00Z' },
        prime: { value: 11.75, last_updated: '2026-04-20T10:00:00Z' },
      })
      mockCalculateProjectedGrowth.mockReturnValue(28123.44)

      const app = makeApp()
      const res = await request(app).get('/api/market-rates/projection?contribution=1000&months=24')

      expect(mockCalculateProjectedGrowth).toHaveBeenCalledWith(1000, 11.75, 24)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        monthly_contribution: 1000,
        months: 24,
        rate_used: 11.75,
        projected_value: 28123.44,
      })
    })

    it('returns 500 when projection route throws unexpectedly', async () => {
      mockGetMarketRates.mockRejectedValue(new Error('Rates unavailable'))

      const app = makeApp()
      const res = await request(app).get('/api/market-rates/projection?contribution=1000&months=12')

      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'Projection failed' })
    })
  })
})
