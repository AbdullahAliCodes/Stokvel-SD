const UUID_HEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeUuid(id) {
  if (typeof id !== 'string') return ''
  const t = id.trim().toLowerCase()
  return UUID_HEX.test(t) ? t : ''
}

export async function groupRoleForUserProfile(client, userId) {
  void client
  void userId
  return 'member'
}
