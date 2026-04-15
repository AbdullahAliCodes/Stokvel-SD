import { getServiceSupabase } from '../utils/supabaseAdmin.js'

/** South African convention: repo + 3.5 percentage points */
const PRIME_SPREAD_PP = 3.5

function requireServiceClient() {
  const client = getServiceSupabase()
  if (!client) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL) must be set for market data updates',
    )
  }
  return client
}

/**
 * Future value of an ordinary annuity (contributions at end of each month).
 * @param {number} monthlyContribution
 * @param {number} annualRatePercent nominal annual rate, e.g. 11.75 for 11.75%
 * @param {number} months
 */
export function calculateProjectedGrowth(
  monthlyContribution,
  annualRatePercent,
  months,
) {
  const pmt = Number(monthlyContribution)
  const annual = Number(annualRatePercent)
  const n = Math.floor(Number(months))
  if (!Number.isFinite(pmt) || !Number.isFinite(annual) || !Number.isFinite(n)) {
    throw new Error('calculateProjectedGrowth: invalid numeric arguments')
  }
  if (n <= 0) return 0

  const r = annual / 100 / 12
  if (r === 0) return parseFloat((pmt * n).toFixed(2))

  const fv = pmt * ((Math.pow(1 + r, n) - 1) / r)
  return parseFloat(fv.toFixed(2))
}

function toRateNumber(value) {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * @returns {Promise<Record<string, { value: number, last_updated: string }>>}
 */
export async function getMarketRates() {
  const supabase = requireServiceClient()
  const { data, error } = await supabase
    .from('market_data')
    .select('rate_type, value, last_updated')

  if (error) {
    throw new Error(`Failed to fetch market rates: ${error.message}`)
  }

  /** @type {Record<string, { value: number, last_updated: string }>} */
  const rates = {}
  for (const row of data ?? []) {
    const v = toRateNumber(row.value)
    if (row.rate_type && v !== null && row.last_updated != null) {
      rates[row.rate_type] = {
        value: v,
        last_updated: row.last_updated,
      }
    }
  }
  return rates
}

/**
 * @param {number} repoRate current repo rate in percent (e.g. 8.25)
 */
export async function updateMarketRates(repoRate) {
  const repo = toRateNumber(repoRate)
  if (repo === null) {
    throw new Error('updateMarketRates: repoRate must be a finite number')
  }

  const primeRate = parseFloat((repo + PRIME_SPREAD_PP).toFixed(2))
  const supabase = requireServiceClient()
  const now = new Date().toISOString()

  const { error: repoErr } = await supabase
    .from('market_data')
    .update({ value: repo, last_updated: now })
    .eq('rate_type', 'repo')

  if (repoErr) {
    throw new Error(`Failed to update repo rate: ${repoErr.message}`)
  }

  const { error: primeErr } = await supabase
    .from('market_data')
    .update({ value: primeRate, last_updated: now })
    .eq('rate_type', 'prime')

  if (primeErr) {
    throw new Error(`Failed to update prime rate: ${primeErr.message}`)
  }
}
