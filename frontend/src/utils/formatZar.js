/** @param {number} amount */
export function formatRand(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return 'R 0.00'
  const negative = n < 0
  const abs = Math.abs(n)
  const [intPart, decPart] = abs.toFixed(2).split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const core = `${withCommas}.${decPart}`
  return negative ? `- R ${core}` : `R ${core}`
}
