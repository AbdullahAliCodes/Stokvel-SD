const UUID_HEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeUuid(id) {
  if (typeof id !== 'string') return ''
  const t = id.trim().toLowerCase()
  return UUID_HEX.test(t) ? t : ''
}

export async function fetchPlatformAdminUserIds(client) {
  const { data, error } = await client.from('profiles').select('id').eq('role', 'admin')
  if (error) return { ids: [], error }

  const ids = Array.isArray(data) ? data.map((row) => row?.id).filter(Boolean) : []
  return { ids, error: null }
}

export async function groupRoleForUserProfile(client, userId) {
  const res = await client
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  // If anything goes wrong (null data or db error), default to member.
  if (res?.data?.role === 'admin') return 'admin'
  return 'member'
}

export async function ensurePlatformAdminsInStokvel(client, stokvelId) {
  const { ids: adminIds, error: adminFetchError } = await fetchPlatformAdminUserIds(client)
  if (adminFetchError) return { error: adminFetchError }

  if (!Array.isArray(adminIds) || adminIds.length === 0) {
    // Early exit: tests expect we never touch stokvel_members if there are no admins.
    return { error: null }
  }

  const { data: existingRows, error: membersError } = await client
    .from('stokvel_members')
    .select('user_id')
    .eq('stokvel_id', stokvelId)

  if (membersError) return { error: membersError }

  const existingIds = new Set(
    Array.isArray(existingRows) ? existingRows.map((row) => row?.user_id).filter(Boolean) : [],
  )

  // Normalize, de-duplicate, and skip invalid UUIDs.
  const normalizedUniqueAdmins = new Set(
    adminIds
      .map((id) => normalizeUuid(id))
      .filter(Boolean),
  )

  const toInsert = [...normalizedUniqueAdmins].filter((id) => !existingIds.has(id))
  if (toInsert.length === 0) return { error: null }

  const insertPayload = toInsert.map((user_id) => ({
    stokvel_id: stokvelId,
    user_id,
    group_role: 'admin',
  }))

  const { error: insertError } = await client.from('stokvel_members').insert(insertPayload)
  return { error: insertError ?? null }
}
