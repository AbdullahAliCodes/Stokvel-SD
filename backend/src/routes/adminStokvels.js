import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { getServiceSupabase } from '../utils/supabaseAdmin.js'
import {
  ensurePlatformAdminsInStokvel,
  groupRoleForUserProfile,
} from '../utils/platformAdminStokvelMembers.js'
import { normalizeUsername } from '../utils/username.js'

const router = Router()

function createUserScopedClient(req) {
  const token = req.headers.authorization.split(' ')[1]
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })
}

/** Prefer service role so admin inserts succeed under typical RLS; else fall back to the caller's JWT. */
function dbClient(req) {
  return getServiceSupabase() ?? createUserScopedClient(req)
}

const ALLOWED_TYPES = new Set(['Rotating', 'Fixed'])
const ALLOWED_PAYOUT = new Set(['Manual', 'Auto-Rotate'])
const ALLOWED_STATUS = new Set(['pending', 'active', 'rejected'])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function escapeIlikePattern(s) {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function normalizeInitialMemberIds(raw, creatorId) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  for (const id of raw) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) continue
    if (id === creatorId) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= 40) break
  }
  return out
}

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const q = rawQ.replace(/,/g, '')
    if (q.length < 2) {
      return res.json({ users: [] })
    }

    const client = dbClient(req)
    const pattern = `%${escapeIlikePattern(q)}%`
    const sel = 'id, first_name, last_name, username'

    const run = (col) => client.from('profiles').select(sel).ilike(col, pattern).limit(15)

    const [byFirst, byLast, byUsername] = await Promise.all([
      run('first_name'),
      run('last_name'),
      run('username'),
    ])

    const firstErr = byFirst.error || byLast.error || byUsername.error
    if (firstErr) {
      console.error('GET /api/admin/users:', firstErr)
      return res.status(500).json({
        error:
          firstErr.message ||
          'Profile search failed. Ensure profiles.username exists and use SUPABASE_SERVICE_ROLE_KEY if RLS blocks reads.',
      })
    }

    const byId = new Map()
    for (const chunk of [byFirst.data, byLast.data, byUsername.data]) {
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
        label,
      }
    })

    return res.json({ users })
  } catch (err) {
    console.error('GET /api/admin/users:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

async function resolveUserIdByAuthList(svc, normalizedEmail) {
  const perPage = 200
  const maxPages = 30
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('auth.admin.listUsers:', error)
      return null
    }
    const match = data.users.find(
      (u) => (u.email || '').trim().toLowerCase() === normalizedEmail,
    )
    if (match?.id) {
      return match.id
    }
    if (data.users.length < perPage) {
      break
    }
  }
  return null
}

async function resolveUserIdByEmail(client, email) {
  const normalized = email.trim().toLowerCase()

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('email', normalized)
    .maybeSingle()

  if (!profileError && profile?.id) {
    return profile.id
  }

  const svc = getServiceSupabase()
  if (!svc?.auth?.admin) {
    return null
  }

  if (typeof svc.auth.admin.getUserByEmail === 'function') {
    try {
      const { data, error } = await svc.auth.admin.getUserByEmail(normalized)
      if (!error && data?.user?.id) {
        return data.user.id
      }
    } catch {
      /* fall through to listUsers */
    }
  }

  return resolveUserIdByAuthList(svc, normalized)
}

async function resolveUserIdByUsername(client, normalized) {
  if (!normalized) return null
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('username', normalized)
    .maybeSingle()
  if (error || !data?.id) {
    return null
  }
  return data.id
}

router.post('/stokvels', requireAuth, requireAdmin, async (req, res) => {
  try {
    const client = dbClient(req)
    const {
      name,
      type,
      contributionAmount,
      payoutStrategy,
      cycleLength,
      initialMemberIds,
    } = req.body ?? {}

    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName) {
      return res.status(400).json({ error: 'Group name is required' })
    }

    const amount = Number(contributionAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Contribution amount must be a positive number' })
    }

    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ error: 'Invalid stokvel type' })
    }

    if (!ALLOWED_PAYOUT.has(payoutStrategy)) {
      return res.status(400).json({ error: 'Invalid payout schedule' })
    }

    const cycle = Number(cycleLength)
    if (!Number.isInteger(cycle) || cycle < 1 || cycle > 240) {
      return res
        .status(400)
        .json({ error: 'Cycle length must be an integer between 1 and 240' })
    }

    const { data: existing, error: existingError } = await client
      .from('stokvels')
      .select('id')
      .eq('name', trimmedName)
      .maybeSingle()

    if (existingError) {
      console.error('admin stokvels duplicate check:', existingError)
      return res.status(500).json({ error: existingError.message })
    }

    if (existing) {
      return res
        .status(409)
        .json({ error: 'A stokvel with this name already exists. Choose a different name.' })
    }

    const insertRow = {
      name: trimmedName,
      type,
      contribution_amount: amount,
      payout_strategy: payoutStrategy,
      cycle_length: cycle,
      status: 'active',
    }

    const { data: stokvel, error: stokvelError } = await client
      .from('stokvels')
      .insert([insertRow])
      .select()
      .single()

    if (stokvelError) {
      console.error('admin stokvels insert:', stokvelError)
      return res.status(500).json({
        error: stokvelError.message || 'Failed to create stokvel',
      })
    }

    const { error: memberError } = await client.from('stokvel_members').insert([
      {
        stokvel_id: stokvel.id,
        user_id: req.user.id,
        group_role: 'admin',
      },
    ])

    if (memberError) {
      console.error('admin stokvels member insert:', memberError)
      const { error: rollbackError } = await client.from('stokvels').delete().eq('id', stokvel.id)
      if (rollbackError) {
        console.error('admin stokvels rollback delete:', rollbackError)
      }
      const constraintHint = String(memberError.message || '').includes('group_role_check')
        ? ' Your database CHECK on stokvel_members.group_role still omits admin. Run supabase/migrations/20260411000001_fix_stokvel_members_group_role_only.sql in the Supabase SQL editor.'
        : ''
      return res.status(500).json({
        error:
          (memberError.message ||
            'Failed to add you as the first member; the group was not created.') + constraintHint,
      })
    }

    const extraIds = normalizeInitialMemberIds(initialMemberIds, req.user.id)
    if (extraIds.length > 0) {
      const { data: profRows, error: profErr } = await client
        .from('profiles')
        .select('id, role')
        .in('id', extraIds)

      if (profErr) {
        console.error('admin stokvels profile roles:', profErr)
        await client.from('stokvel_members').delete().eq('stokvel_id', stokvel.id)
        await client.from('stokvels').delete().eq('id', stokvel.id)
        return res.status(500).json({ error: profErr.message })
      }

      const roleById = new Map((profRows ?? []).map((p) => [p.id, p.role]))
      const memberRows = extraIds.map((user_id) => ({
        stokvel_id: stokvel.id,
        user_id,
        group_role: roleById.get(user_id) === 'admin' ? 'admin' : 'member',
      }))

      const { error: extraError } = await client.from('stokvel_members').insert(memberRows)
      if (extraError) {
        console.error('admin stokvels extra members insert:', extraError)
        await client.from('stokvel_members').delete().eq('stokvel_id', stokvel.id)
        const { error: rb2 } = await client.from('stokvels').delete().eq('id', stokvel.id)
        if (rb2) console.error('admin stokvels rollback after extras:', rb2)
        return res.status(500).json({
          error:
            extraError.message ||
            'Failed to add selected members; the group was not created.',
        })
      }
    }

    const { error: syncErr } = await ensurePlatformAdminsInStokvel(client, stokvel.id)
    if (syncErr) {
      console.error('admin stokvels platform admin sync:', syncErr)
      await client.from('stokvel_members').delete().eq('stokvel_id', stokvel.id)
      const { error: rb3 } = await client.from('stokvels').delete().eq('id', stokvel.id)
      if (rb3) console.error('admin stokvels rollback after sync:', rb3)
      return res.status(500).json({
        error:
          syncErr.message ||
          'Failed to attach all platform admins to this stokvel; group was not created.',
      })
    }

    return res.status(201).json({ success: true, stokvel })
  } catch (err) {
    console.error('POST /api/admin/stokvels:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.post('/stokvels/:stokvelId/members', requireAuth, requireAdmin, async (req, res) => {
  try {
    const client = dbClient(req)
    const { stokvelId } = req.params
    const body = req.body ?? {}

    const rawUsername = typeof body.username === 'string' ? body.username.trim() : ''
    const identifier =
      typeof body.identifier === 'string' ? body.identifier.trim() : ''
    const rawLegacy = typeof body.email === 'string' ? body.email.trim() : ''

    const raw =
      rawUsername || identifier || rawLegacy || ''

    if (!raw) {
      return res.status(400).json({
        error:
          'Provide username (profiles.username). Optional: use an email only if it contains @ and you sync Auth email lookup.',
      })
    }

    let targetUserId = null
    if (raw.includes('@')) {
      targetUserId = await resolveUserIdByEmail(client, raw)
    } else {
      const normalized = normalizeUsername(raw)
      if (!normalized) {
        return res.status(400).json({
          error:
            'Username must be 3–30 characters (letters, numbers, underscore). Ask the member to set it under Account.',
        })
      }
      targetUserId = await resolveUserIdByUsername(client, normalized)
    }

    if (!targetUserId) {
      return res.status(400).json({
        error: raw.includes('@')
          ? 'No user found for that email (Auth lookup may need SUPABASE_SERVICE_ROLE_KEY).'
          : 'No user with that username. They must save it on Account (profiles.username).',
      })
    }

    const { data: group, error: groupError } = await client
      .from('stokvels')
      .select('id')
      .eq('id', stokvelId)
      .maybeSingle()

    if (groupError) {
      console.error('admin invite group lookup:', groupError)
      return res.status(500).json({ error: groupError.message })
    }

    if (!group) {
      return res.status(404).json({ error: 'Stokvel not found' })
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'You are already a member of this group.' })
    }

    const { data: already, error: alreadyError } = await client
      .from('stokvel_members')
      .select('id')
      .eq('stokvel_id', stokvelId)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (alreadyError) {
      console.error('admin invite duplicate check:', alreadyError)
      return res.status(500).json({ error: alreadyError.message })
    }

    if (already) {
      return res.status(409).json({ error: 'That user is already a member of this stokvel.' })
    }

    const invitedGroupRole = await groupRoleForUserProfile(client, targetUserId)

    const { error: insertError } = await client.from('stokvel_members').insert([
      {
        stokvel_id: stokvelId,
        user_id: targetUserId,
        group_role: invitedGroupRole,
      },
    ])

    if (insertError) {
      console.error('admin invite insert:', insertError)
      return res.status(500).json({ error: insertError.message || 'Failed to add member' })
    }

    return res.status(201).json({ success: true, userId: targetUserId })
  } catch (err) {
    console.error('POST /api/admin/stokvels/:stokvelId/members:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.get('/stokvels', requireAuth, requireAdmin, async (req, res) => {
  try {
    const client = dbClient(req)
    const { data, error } = await client
      .from('stokvels')
      .select(
        'id, name, type, status, contribution_amount, payout_strategy, cycle_length, created_at',
      )
      .order('created_at', { ascending: false })

    if (error) {
      console.error('GET /api/admin/stokvels:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.json({ success: true, stokvels: data ?? [] })
  } catch (err) {
    console.error('GET /api/admin/stokvels:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.get('/stokvels/:stokvelId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const client = dbClient(req)
    const { stokvelId } = req.params
    const { data, error } = await client.from('stokvels').select('*').eq('id', stokvelId).maybeSingle()

    if (error) {
      console.error('GET /api/admin/stokvels/:id:', error)
      return res.status(500).json({ error: error.message })
    }

    if (!data) {
      return res.status(404).json({ error: 'Stokvel not found' })
    }

    return res.json({ success: true, stokvel: data })
  } catch (err) {
    console.error('GET /api/admin/stokvels/:id:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.patch('/stokvels/:stokvelId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const client = dbClient(req)
    const { stokvelId } = req.params
    const body = req.body ?? {}

    const { data: existing, error: exErr } = await client
      .from('stokvels')
      .select('id')
      .eq('id', stokvelId)
      .maybeSingle()

    if (exErr) {
      console.error('PATCH /api/admin/stokvels lookup:', exErr)
      return res.status(500).json({ error: exErr.message })
    }

    if (!existing) {
      return res.status(404).json({ error: 'Stokvel not found' })
    }

    const patch = {}

    if (typeof body.name === 'string') {
      const trimmed = body.name.trim()
      if (!trimmed) {
        return res.status(400).json({ error: 'Name cannot be empty' })
      }
      const { data: dup, error: dupErr } = await client
        .from('stokvels')
        .select('id')
        .eq('name', trimmed)
        .neq('id', stokvelId)
        .maybeSingle()
      if (dupErr) {
        console.error('PATCH /api/admin/stokvels dup:', dupErr)
        return res.status(500).json({ error: dupErr.message })
      }
      if (dup) {
        return res.status(409).json({ error: 'Another stokvel already uses this name.' })
      }
      patch.name = trimmed
    }

    if (body.type !== undefined) {
      if (!ALLOWED_TYPES.has(body.type)) {
        return res.status(400).json({ error: 'Invalid stokvel type' })
      }
      patch.type = body.type
    }

    if (body.payoutStrategy !== undefined) {
      if (!ALLOWED_PAYOUT.has(body.payoutStrategy)) {
        return res.status(400).json({ error: 'Invalid payout schedule' })
      }
      patch.payout_strategy = body.payoutStrategy
    }

    if (body.status !== undefined) {
      if (!ALLOWED_STATUS.has(body.status)) {
        return res.status(400).json({ error: 'Invalid status' })
      }
      patch.status = body.status
    }

    if (body.contributionAmount !== undefined) {
      const amount = Number(body.contributionAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Contribution amount must be a positive number' })
      }
      patch.contribution_amount = amount
    }

    if (body.cycleLength !== undefined) {
      const cycle = Number(body.cycleLength)
      if (!Number.isInteger(cycle) || cycle < 1 || cycle > 240) {
        return res
          .status(400)
          .json({ error: 'Cycle length must be an integer between 1 and 240' })
      }
      patch.cycle_length = cycle
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' })
    }

    const { data: updated, error: upErr } = await client
      .from('stokvels')
      .update(patch)
      .eq('id', stokvelId)
      .select()
      .single()

    if (upErr) {
      console.error('PATCH /api/admin/stokvels:', upErr)
      return res.status(500).json({ error: upErr.message || 'Update failed' })
    }

    return res.json({ success: true, stokvel: updated })
  } catch (err) {
    console.error('PATCH /api/admin/stokvels:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

export default router
