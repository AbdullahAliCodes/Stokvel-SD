export function readLastStokvelId() {
  try {
    const last = localStorage.getItem('last_stokvel_id')
    return last && String(last).length ? String(last) : null
  } catch {
    return null
  }
}

export function stokvelIdFromPath(pathname) {
  const match = String(pathname || '').match(/^\/group\/([^/]+)/)
  return match?.[1] ?? null
}

export function groupDashboardPath(stokvelId) {
  const id = stokvelId || readLastStokvelId()
  return id ? `/group/${id}/dashboard` : '/dashboard'
}

export function adminPageBackTarget(pathname) {
  const path = String(pathname || '')
  if (path === '/admin' || path === '/admin/groups') {
    return null
  }
  if (path.startsWith('/admin/')) {
    return { to: '/admin/groups', label: 'Back to groups' }
  }
  return null
}
