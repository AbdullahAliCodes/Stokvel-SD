import { Router } from 'express'
import {
  getMarketRates,
  calculateProjectedGrowth,
} from '../services/marketDataService.js'

const router = Router()

/** GET /api/market-rates */
router.get('/', async (_req, res) => {
  try {
    const rates = await getMarketRates()
    if (!rates.repo || !rates.prime) {
      return res.status(503).json({ error: 'Market rates not available yet' })
    }
    return res.json({
      repo_rate: rates.repo.value,
      prime_rate: rates.prime.value,
      last_updated: rates.repo.last_updated,
    })
  } catch (err) {
    console.error('GET /api/market-rates:', err)
    return res.status(500).json({ error: 'Could not retrieve market rates' })
  }
})

/** GET /api/market-rates/projection?contribution=1000&months=12 */
router.get('/projection', async (req, res) => {
  try {
    const contribution = parseFloat(req.query.contribution)
    const months = parseInt(String(req.query.months), 10) || 12

    if (!Number.isFinite(contribution) || contribution <= 0) {
      return res.status(400).json({
        error: 'Query "contribution" must be a positive number',
      })
    }
    if (!Number.isFinite(months) || months < 1 || months > 600) {
      return res.status(400).json({
        error: 'Query "months" must be between 1 and 600',
      })
    }

    const rates = await getMarketRates()
    if (!rates.prime) {
      return res.status(503).json({ error: 'Market rates not available yet' })
    }

    const projectedValue = calculateProjectedGrowth(
      contribution,
      rates.prime.value,
      months,
    )

    return res.json({
      monthly_contribution: contribution,
      months,
      rate_used: rates.prime.value,
      projected_value: projectedValue,
    })
  } catch (err) {
    console.error('GET /api/market-rates/projection:', err)
    return res.status(500).json({ error: 'Projection failed' })
  }
})

export default router