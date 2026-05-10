import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { getServiceSupabase } from '../utils/supabaseAdmin.js'
import {
  groupRoleForUserProfile,
} from '../utils/platformAdminStokvelMembers.js'
import { normalizeUsername } from '../utils/username.js'
import {
  createInvitation,
  normalizeInviteEmail,
  sendGroupAddedEmail,
  sendGroupStatusEmail,
  sendInvitationEmail,
} from '../utils/invitations.js'
import { activateStokvel } from '../utils/stokvelActivation.js'

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

/** True if `row` already reflects every key in `patch` (used after UPDATE returns 0 rows). */
function rowMatchesPatch(row, patch) {
  if (!row || !patch || Object.keys(patch).length === 0) return false
  for (const [key, val] of Object.entries(patch)) {
    if (!(key in row)) return false
    const got = row[key]
    if (got === val) continue
    if (val != null && got != null && String(got).toLowerCase() === String(val).toLowerCase()) continue
    if (typeof val === 'number' && Number(got) === val) continue
    return false
  }
  return true
}

/**
 * UPDATE … SELECT without `.single()` (avoids PGRST116). If UPDATE returns no rows, we only
 * succeed if a refetch proves the row already matches `patch` (idempotent); otherwise we fail
 * so we never return 200 when RLS blocked the write but SELECT still returns the old row.
 */
async function updateStokvelReturningRow(client, stokvelId, patch) {
  const writer = getServiceSupabase() ?? client
  const { data: rows, error } = await writer
    .from('stokvels')
    .update(patch)
    .eq('id', stokvelId)
    .select('*')

  if (error) {
    return { stokvel: null, error }
  }

  const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
  if (first) {
    return { stokvel: first, error: null }
  }

  const reader = getServiceSupabase() ?? client
  const { data: current, error: err2 } = await reader
    .from('stokvels')
    .select('*')
    .eq('id', stokvelId)
    .maybeSingle()

  if (err2) {
    return { stokvel: null, error: err2 }
  }

  if (current && rowMatchesPatch(current, patch)) {
    return { stokvel: current, error: null }
  }

  if (current) {
    return {
      stokvel: null,
      error: new Error(
        'No rows were updated (RLS or permissions). Set SUPABASE_SERVICE_ROLE_KEY on the API server or add a policy allowing platform admins to update stokvels.',
      ),
    }
  }

  return {
    stokvel: null,
    error: new Error('Stokvel not found or update returned no rows.'),
  }
}

const ALLOWED_TYPES = new Set(['Rotating', 'Fixed'])
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

function normalizeTreasurerUserId(raw) {
  if (typeof raw !== 'string') return ''
  const v = raw.trim()
  return UUID_RE.test(v) ? v : ''
}

function normalizeMembersCount(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 500) return null
  return n
}

function normalizeMemberDetails(raw, limit = 500) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((m) => {
      const maybeUid = typeof m?.userId === 'string' ? m.userId.trim() : ''
      const userId = UUID_RE.test(maybeUid) ? maybeUid : ''
      return {
        userId,
        name: typeof m?.name === 'string' ? m.name.trim() : '',
        email: typeof m?.email === 'string' ? m.email.trim().toLowerCase() : '',
        role: typeof m?.role === 'string' ? m.role.trim() : '',
      }
    })
    .filter((m) => m.name || m.email || m.role)
    .slice(0, limit)
}

function normalizeProfilePatchEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!email) return ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

/**
 * When admin create supplies an email for a user in this stokvel, persist it on `profiles`
 * if the profile row still has no email (does not overwrite existing contact email).
 */
async function applyMemberDetailEmailsToProfiles(client, memberDetails, allowedUserIds) {
  if (!Array.isArray(memberDetails) || memberDetails.length === 0) return
  const allowed = allowedUserIds instanceof Set ? allowedUserIds : new Set(allowedUserIds)
  for (const row of memberDetails) {
    const uid = typeof row.userId === 'string' ? row.userId.trim() : ''
    if (!UUID_RE.test(uid) || !allowed.has(uid)) continue
    const email = normalizeProfilePatchEmail(row.email)
    if (!email) continue
    const { data: prof, error: selErr } = await client
      .from('profiles')
      .select('id, email')
      .eq('id', uid)
      .maybeSingle()
    if (selErr) {
      console.error('applyMemberDetailEmailsToProfiles select:', selErr)
      continue
    }
    if (!prof) continue
    if (String(prof.email || '').trim()) continue
    const { error: upErr } = await client.from('profiles').update({
      email,
      updated_at: new Date().toISOString(),
    }).eq('id', uid)
    if (upErr) {
      console.error('applyMemberDetailEmailsToProfiles update:', uid, upErr.message)
    }
  }
}

function normalizeDocuments(raw, limit = 50) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((d) => (typeof d === 'string' ? d.trim() : ''))
    .filter(Boolean)
    .slice(0, limit)
}

async function getGroupAndCreatorContact(client, stokvelId) {
  const { data: stokvel, error: stokvelError } = await client
    .from('stokvels')
    .select('id, name, created_by')
    .eq('id', stokvelId)
    .maybeSingle()
  if (stokvelError || !stokvel) return { stokvel: null, creatorEmail: '', creatorId: null }

  const createdBy = typeof stokvel.created_by === 'string' ? stokvel.created_by : ''
  let creatorId = createdBy || null
  if (!creatorId) {
    const { data: creatorRow } = await client
      .from('stokvel_members')
      .select('user_id')
      .eq('stokvel_id', stokvelId)
      .eq('group_role', 'treasurer')
      .maybeSingle()
    creatorId = creatorRow?.user_id || null
  }
  if (!creatorId) return { stokvel, creatorEmail: '', creatorId: null }

  const { data: profile } = await client
    .from('profiles')
    .select('email')
    .eq('id', creatorId)
    .maybeSingle()

  return { stokvel, creatorEmail: profile?.email || '', creatorId }
}

async function notifyAllCurrentMembersAdded(client, { stokvelId, groupName }) {
  const { data: members, error: membersError } = await client
    .from('stokvel_members')
    .select('user_id, group_role')
    .eq('stokvel_id', stokvelId)

  if (membersError || !Array.isArray(members) || members.length === 0) return

  const uniqueUserIds = [...new Set(members.map((m) => m?.user_id).filter(Boolean))]
  if (uniqueUserIds.length === 0) return

  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('id, email')
    .in('id', uniqueUserIds)
  if (profilesError || !Array.isArray(profiles) || profiles.length === 0) return

  const emailByUserId = new Map(
    profiles
      .map((p) => [p.id, normalizeInviteEmail(p.email)])
      .filter(([, email]) => Boolean(email)),
  )
  const emailed = new Set()

  await Promise.all(
    members.map(async (m) => {
      const userId = m?.user_id
      const to = emailByUserId.get(userId)
      if (!to || emailed.has(to)) return
      emailed.add(to)
      const role =
        typeof m?.group_role === 'string' && m.group_role.trim() ? m.group_role.trim() : 'member'
      await sendGroupAddedEmail({ to, groupName, role })
    }),
  )
}

async function notifyMemberAdded(client, { userId, groupName, role }) {
  const { data: profile } = await client
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()
  const to = normalizeInviteEmail(profile?.email)
  if (!to) return
  await sendGroupAddedEmail({ to, groupName, role })
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
    const sel = 'id, first_name, last_name, username, email'

    const run = (col) => client.from('profiles').select(sel).ilike(col, pattern).limit(15)

    const [byFirst, byLast, byUsername, byEmail] = await Promise.all([
      run('first_name'),
      run('last_name'),
      run('username'),
      run('email'),
    ])

    const firstErr = byFirst.error || byLast.error || byUsername.error || byEmail.error
    if (firstErr) {
      console.error('GET /api/admin/users:', firstErr)
      return res.status(500).json({
        error:
          firstErr.message ||
          'Profile search failed. Ensure profiles.username exists and use SUPABASE_SERVICE_ROLE_KEY if RLS blocks reads.',
      })
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
    const body = req.body ?? {}
    const {
      name,
      type,
      contributionAmount,
      cycleLength,
      initialMemberIds,
      treasurerUserId,
      membersCount,
      payoutOrder,
      meetingFrequency,
      memberDetails,
      documents,
    } = body

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

    const membersCountNorm = normalizeMembersCount(membersCount)
    const normalizedMemberDetails = normalizeMemberDetails(memberDetails, membersCountNorm ?? 500)

    const potIn = body.payout_order_type ?? body.payoutOrderType ?? payoutOrder
    const payoutOrderType =
      typeof potIn === 'string' && potIn.toLowerCase() === 'manual' ? 'manual' : 'randomize'
    const proposedRaw = body.proposed_payout_sequence ?? body.proposedPayoutSequence
    const proposedSeq = Array.isArray(proposedRaw)
      ? proposedRaw.filter((id) => typeof id === 'string')
      : []

    const insertRow = {
      name: trimmedName,
      type,
      contribution_amount: amount,
      payout_order: payoutOrderType === 'manual' ? 'manual' : 'randomize',
      payout_order_type: payoutOrderType,
      proposed_payout_sequence: proposedSeq,
      meeting_frequency: typeof meetingFrequency === 'string' ? meetingFrequency : 'monthly',
      cycle_length: cycle,
      members_count: membersCountNorm,
      member_details: normalizedMemberDetails,
      documents: normalizeDocuments(documents),
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

    const extraIds = normalizeInitialMemberIds(initialMemberIds, req.user.id)
    const allowedProfileEmailIds = new Set([req.user.id, ...extraIds])
    const allSelectableIds = allowedProfileEmailIds
    const requestedTreasurerId = normalizeTreasurerUserId(treasurerUserId) || req.user.id
    if (!allSelectableIds.has(requestedTreasurerId)) {
      return res.status(400).json({
        error: 'Treasurer must be you or one of the selected initial members.',
      })
    }

    const creatorRole = requestedTreasurerId === req.user.id ? 'treasurer' : 'admin'
    const { error: memberError } = await client.from('stokvel_members').insert([
      {
        stokvel_id: stokvel.id,
        user_id: req.user.id,
        group_role: creatorRole,
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
        group_role:
          user_id === requestedTreasurerId
            ? 'treasurer'
            : roleById.get(user_id) === 'admin'
              ? 'admin'
              : 'member',
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

    await applyMemberDetailEmailsToProfiles(client, normalizedMemberDetails, allowedProfileEmailIds)

    // Fire-and-forget style notifications for members added during create.
    const allAddedIds = normalizeInitialMemberIds(initialMemberIds, req.user.id)
    await Promise.all(
      allAddedIds.map((userId) =>
        notifyMemberAdded(client, {
          userId,
          groupName: stokvel.name,
          role: 'member',
        }),
      ),
    )

    const svcAct = getServiceSupabase() ?? client
    const act = await activateStokvel(stokvel.id, svcAct)
    if (!act.ok) {
      console.error('admin POST /stokvels activateStokvel:', act.error)
      await client.from('stokvel_members').delete().eq('stokvel_id', stokvel.id)
      const { error: rbDel } = await client.from('stokvels').delete().eq('id', stokvel.id)
      if (rbDel) console.error('admin POST /stokvels rollback stokvel:', rbDel)
      return res.status(400).json({
        error:
          act.error ||
          'Payout schedule could not be generated (check paying members vs cycle length).',
      })
    }

    const { data: stokvelOut } = await client
      .from('stokvels')
      .select('*')
      .eq('id', stokvel.id)
      .maybeSingle()

    return res.status(201).json({ success: true, stokvel: stokvelOut ?? stokvel })
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
      .select('id, name')
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

    await notifyMemberAdded(client, {
      userId: targetUserId,
      groupName: group.name,
      role: invitedGroupRole,
    })

    return res.status(201).json({ success: true, userId: targetUserId })
  } catch (err) {
    console.error('POST /api/admin/stokvels/:stokvelId/members:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.post('/stokvels/:stokvelId/invitations', requireAuth, requireAdmin, async (req, res) => {
  try {
    const client = dbClient(req)
    const { stokvelId } = req.params
    const email = normalizeInviteEmail(req.body?.email)
    if (!email) return res.status(400).json({ error: 'Provide a valid email address.' })

    const { data: group, error: groupError } = await client
      .from('stokvels')
      .select('id, name')
      .eq('id', stokvelId)
      .maybeSingle()
    if (groupError) return res.status(500).json({ error: groupError.message })
    if (!group) return res.status(404).json({ error: 'Stokvel not found' })

    const { data: existingProfile } = await client
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile?.id) {
      const role = await groupRoleForUserProfile(client, existingProfile.id)
      const { error: upsertErr } = await client.from('stokvel_members').upsert(
        { stokvel_id: stokvelId, user_id: existingProfile.id, group_role: role },
        { onConflict: 'stokvel_id,user_id' },
      )
      if (upsertErr) return res.status(500).json({ error: upsertErr.message })
      await sendGroupAddedEmail({ to: email, groupName: group.name, role })
      return res.status(201).json({ success: true, mode: 'added_existing_user' })
    }

    const { data: invite, error: inviteError } = await createInvitation(client, {
      stokvelId,
      email,
      invitedBy: req.user.id,
      status: 'pending',
    })
    if (inviteError) return res.status(500).json({ error: inviteError.message })

    await sendInvitationEmail({ to: email, groupName: group.name, token: invite.token })
    return res.status(201).json({ success: true, mode: 'invite_sent' })
  } catch (err) {
    console.error('POST /api/admin/stokvels/:stokvelId/invitations:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.get('/stokvels', requireAuth, requireAdmin, async (req, res) => {
  try {
    const client = dbClient(req)
    const { data, error } = await client
      .from('stokvels')
      .select(
        'id, name, type, status, contribution_amount, cycle_length, created_at',
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

    const activating = body.status === 'active'

    if (body.status !== undefined) {
      if (!ALLOWED_STATUS.has(body.status)) {
        return res.status(400).json({ error: 'Invalid status' })
      }
      if (!activating) {
        patch.status = body.status
      }
    }

    if (body.payoutOrderType !== undefined) {
      const t = String(body.payoutOrderType).toLowerCase()
      if (t !== 'manual' && t !== 'randomize') {
        return res.status(400).json({ error: 'Invalid payout order type' })
      }
      patch.payout_order_type = t
    }

    if (body.proposedPayoutSequence !== undefined) {
      if (!Array.isArray(body.proposedPayoutSequence)) {
        return res.status(400).json({ error: 'proposedPayoutSequence must be an array of UUID strings' })
      }
      patch.proposed_payout_sequence = body.proposedPayoutSequence.filter((id) => typeof id === 'string')
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

    if (Object.keys(patch).length === 0 && !activating) {
      return res.status(400).json({ error: 'No valid fields to update.' })
    }

    if (activating) {
      const { data: preRow } = await client
        .from('stokvels')
        .select('id, name, status')
        .eq('id', stokvelId)
        .maybeSingle()
      const groupNameForInvites = typeof preRow?.name === 'string' ? preRow.name : ''

      const { data: pendingInvites, error: invitesError } = await client
        .from('invitations')
        .select('id, email, group_role')
        .eq('stokvel_id', stokvelId)
        .eq('status', 'pending_group_request')

      if (!invitesError && Array.isArray(pendingInvites)) {
        for (const invite of pendingInvites) {
          const inviteEmail = normalizeInviteEmail(invite.email)
          if (!inviteEmail) continue

          const { data: profile } = await client
            .from('profiles')
            .select('id')
            .eq('email', inviteEmail)
            .maybeSingle()

          const inviteRole =
            typeof invite.group_role === 'string' && invite.group_role.trim()
              ? invite.group_role.trim().toLowerCase()
              : null
          if (profile?.id) {
            const role = inviteRole || (await groupRoleForUserProfile(client, profile.id))
            const { error: insErr } = await client.from('stokvel_members').upsert(
              {
                stokvel_id: stokvelId,
                user_id: profile.id,
                group_role: role,
              },
              { onConflict: 'stokvel_id,user_id' },
            )
            if (!insErr) {
              await sendGroupAddedEmail({ to: inviteEmail, groupName: groupNameForInvites, role })
            }
          } else {
            const { data: created } = await createInvitation(client, {
              stokvelId,
              email: inviteEmail,
              invitedBy: req.user.id,
              status: 'pending',
              groupRole: inviteRole,
            })
            if (created?.token) {
              await sendInvitationEmail({
                to: inviteEmail,
                groupName: groupNameForInvites,
                token: created.token,
              })
            }
          }

          await client.from('invitations').update({ status: 'processed' }).eq('id', invite.id)
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      const { stokvel: upRow, error: upErr } = await updateStokvelReturningRow(client, stokvelId, patch)

      if (upErr) {
        console.error('PATCH /api/admin/stokvels:', upErr)
        return res.status(500).json({ error: upErr.message || String(upErr) || 'Update failed' })
      }

      if (!upRow) {
        return res.status(404).json({ error: 'Stokvel not found after update.' })
      }
    }

    if (activating) {
      const svc = getServiceSupabase()
      if (!svc) {
        return res.status(500).json({
          error:
            'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is required to activate a stokvel and generate payouts.',
        })
      }
      const act = await activateStokvel(stokvelId, svc)
      if (!act.ok) {
        return res.status(400).json({
          error: act.error || 'Activation failed (payout schedule or member roster).',
        })
      }
    }

    const { data: finalRow, error: finErr } = await client
      .from('stokvels')
      .select('*')
      .eq('id', stokvelId)
      .maybeSingle()

    if (finErr) {
      console.error('PATCH /api/admin/stokvels refetch:', finErr)
      return res.status(500).json({ error: finErr.message })
    }
    if (!finalRow) {
      return res.status(404).json({ error: 'Stokvel not found after update.' })
    }

    if (body.status === 'active' || body.status === 'rejected') {
      const { creatorEmail } = await getGroupAndCreatorContact(client, stokvelId)
      const recipient = normalizeInviteEmail(creatorEmail)
      if (recipient && (body.status === 'active' || body.status === 'rejected')) {
        await sendGroupStatusEmail({
          to: recipient,
          groupName: finalRow.name,
          status: body.status,
        })
      }
    }
    if (body.status === 'active') {
      await notifyAllCurrentMembersAdded(client, {
        stokvelId,
        groupName: finalRow.name,
      })
    }

    return res.json({ success: true, stokvel: finalRow })
  } catch (err) {
    console.error('PATCH /api/admin/stokvels:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.delete('/stokvels/:stokvelId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const client = dbClient(req)
    const { stokvelId } = req.params

    const { data: existing, error: exErr } = await client
      .from('stokvels')
      .select('id, name')
      .eq('id', stokvelId)
      .maybeSingle()
    if (exErr) return res.status(500).json({ error: exErr.message })
    if (!existing) return res.status(404).json({ error: 'Stokvel not found' })

    const { error: memberDeleteErr } = await client
      .from('stokvel_members')
      .delete()
      .eq('stokvel_id', stokvelId)
    if (memberDeleteErr) return res.status(500).json({ error: memberDeleteErr.message })

    const { error: invitationDeleteErr } = await client
      .from('invitations')
      .delete()
      .eq('stokvel_id', stokvelId)
    if (invitationDeleteErr) return res.status(500).json({ error: invitationDeleteErr.message })

    const { error: meetingDeleteErr } = await client
      .from('meetings')
      .delete()
      .eq('stokvel_id', stokvelId)
    if (meetingDeleteErr) return res.status(500).json({ error: meetingDeleteErr.message })

    const { error: contributionDeleteErr } = await client
      .from('contributions')
      .delete()
      .eq('stokvel_id', stokvelId)
    if (contributionDeleteErr) return res.status(500).json({ error: contributionDeleteErr.message })

    const { error: payoutDeleteErr } = await client
      .from('payouts')
      .delete()
      .eq('stokvel_id', stokvelId)
    if (payoutDeleteErr) return res.status(500).json({ error: payoutDeleteErr.message })

    const { error: issueDeleteErr } = await client
      .from('issues')
      .delete()
      .eq('stokvel_id', stokvelId)
    if (issueDeleteErr) return res.status(500).json({ error: issueDeleteErr.message })

    const { error: stokvelDeleteErr } = await client.from('stokvels').delete().eq('id', stokvelId)
    if (stokvelDeleteErr) return res.status(500).json({ error: stokvelDeleteErr.message })

    return res.json({ success: true, deletedId: stokvelId })
  } catch (err) {
    console.error('DELETE /api/admin/stokvels/:stokvelId:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

export default router
