/**
 * Users with profiles.role = 'admin' are platform admins.
 * They are automatically added to each stokvel with stokvel_members.group_role = 'admin'
 * (requires DB CHECK to allow 'admin' — see supabase migrations).
 */

const UUID_HEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Canonical lowercase UUID string for stable Set lookups (avoids duplicate membership rows). */
export function normalizeUuid(id) {
  if (typeof id !== 'string') return ''
  const t = id.trim().toLowerCase()
  return UUID_HEX.test(t) ? t : ''
}

export async function fetchPlatformAdminUserIds(client) {
  const { data, error } = await client.from('profiles').select('id').eq('role', 'admin')
  if (error) {
    return { ids: [], error }
  }
  const ids = (data ?? []).map((r) => r.id).filter(Boolean)
  return { ids, error: null }
}

export async function groupRoleForUserProfile(client, userId) {
  const { data, error } = await client
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) {
    return 'member'
  }
  return data.role === 'admin' ? 'admin' : 'member'
}

/**
 * Insert missing stokvel_members rows for every platform admin on this stokvel.
 */
export async function ensurePlatformAdminsInStokvel(client, stokvelId) {
  const { ids: adminIds, error: adminErr } = await fetchPlatformAdminUserIds(client)
  if (adminErr) {
    return { error: adminErr }
  }
  if (adminIds.length === 0) {
    return { error: null }
  }

  const { data: existingRows, error: exErr } = await client
    .from('stokvel_members')
    .select('user_id')
    .eq('stokvel_id', stokvelId)

  if (exErr) {
    return { error: exErr }
  }

  const existing = new Set(
    (existingRows ?? []).map((r) => normalizeUuid(r.user_id)).filter(Boolean),
  )
  const seenInsert = new Set()
  const toInsert = []
  for (const rawId of adminIds) {
    const user_id = normalizeUuid(rawId)
    if (!user_id || existing.has(user_id) || seenInsert.has(user_id)) continue
    seenInsert.add(user_id)
    toInsert.push({
      stokvel_id: stokvelId,
      user_id,
      group_role: 'admin',
    })
  }

  if (toInsert.length === 0) {
    return { error: null }
  }

  const { error: insErr } = await client.from('stokvel_members').insert(toInsert)
  if (insErr) {
    return { error: insErr }
  }
  return { error: null }
}
