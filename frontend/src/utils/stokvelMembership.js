/** Normalized stokvel row status from a `stokvel_members` + `stokvels` join. */
export function stokvelStatusOf(m) {
  return String(m?.stokvels?.status ?? '').toLowerCase()
}

export function myStokvelsCacheKey(userId) {
  return `my_stokvels:${userId}`
}
