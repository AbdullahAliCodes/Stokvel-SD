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

export function memberPageBackTarget(pathname) {
  const path = String(pathname || '')

  if (/^\/group\/[^/]+\/dashboard\/?$/.test(path)) {
    return null
  }

  const scopedId = stokvelIdFromPath(path)
  if (scopedId && /^\/group\/[^/]+\//.test(path)) {
    return { to: `/group/${scopedId}/dashboard`, label: 'Back to dashboard' }
  }

  if (
    path === '/account' ||
    path === '/support' ||
    path === '/apply' ||
    path === '/my-payout'
  ) {
    return { to: groupDashboardPath(null), label: 'Back to dashboard' }
  }

  return null
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
