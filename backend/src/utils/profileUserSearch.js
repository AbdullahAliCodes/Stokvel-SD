import { getServiceSupabase, createUserJwtSupabase } from './supabaseAdmin.js'
import { sendSupabaseFailure } from './supabaseErrors.js'

function escapeIlikePattern(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

/** Search profiles for inviting members (used by GET /api/users and GET /api/stokvels/members/search). */
export async function searchProfilesForMemberInvite(req, res) {
  try {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const q = rawQ.replace(/,/g, '')
    if (q.length < 2) {
      return res.json({ users: [] })
    }

    const client = getServiceSupabase() ?? createUserJwtSupabase(req, 'profile search')
    if (!client) {
      sendSupabaseFailure(
        res,
        Object.assign(new Error('Supabase client unavailable'), {
          code: 'SUPABASE_CLIENT_UNAVAILABLE',
        }),
        'profile user search',
      )
      return
    }
    const pattern = `%${escapeIlikePattern(q)}%`
    const sel = 'id, first_name, last_name, username, email'

    const run = (col) =>
      client.from('profiles').select(sel).ilike(col, pattern).limit(15)

    const [byFirst, byLast, byUsername, byEmail] = await Promise.all([
      run('first_name'),
      run('last_name'),
      run('username'),
      run('email'),
    ])

    const firstErr = byFirst.error || byLast.error || byUsername.error || byEmail.error
    if (firstErr) {
      sendSupabaseFailure(res, firstErr, 'profile user search')
      return
    }

    const byId = new Map()
    for (const chunk of [byFirst.data, byLast.data, byUsername.data, byEmail.data]) {
      for (const row of chunk ?? []) {
        byId.set(row.id, row)
      }
    }
    const rows = [...byId.values()].slice(0, 25)

    const users = rows.map((r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim()
      const uname = r.username ? String(r.username) : ''
      const handle = uname ? `@${uname}` : ''
      const labelParts = [handle, name || null].filter(Boolean)
      const label = labelParts.length ? labelParts.join(' · ') : r.id
      return {
        id: r.id,
        username: uname,
        firstName: r.first_name ?? '',
        lastName: r.last_name ?? '',
        email: typeof r.email === 'string' ? r.email.trim() : '',
        label,
      }
    })

    return res.json({ users })
  } catch (err) {
    console.error('profile user search:', err)
    sendSupabaseFailure(res, err, 'profile user search')
  }
}
