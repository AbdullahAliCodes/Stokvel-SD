/**
 * Users with profiles.role = 'admin' are platform admins.
 * They are automatically added to each stokvel with stokvel_members.group_role = 'admin'
 * (requires DB CHECK to allow 'admin' — see supabase migrations).
 */

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

  const existing = new Set((existingRows ?? []).map((r) => r.user_id))
  const toInsert = adminIds
    .filter((uid) => !existing.has(uid))
    .map((user_id) => ({
      stokvel_id: stokvelId,
      user_id,
      group_role: 'admin',
    }))

  if (toInsert.length === 0) {
    return { error: null }
  }

  const { error: insErr } = await client.from('stokvel_members').insert(toInsert)
  if (insErr) {
    return { error: insErr }
  }
  return { error: null }
}
