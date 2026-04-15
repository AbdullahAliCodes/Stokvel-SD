import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../middleware/auth.js'
import {
  createInvitation,
  normalizeInviteEmail,
  sendMeetingScheduledEmail,
} from '../utils/invitations.js'
import { getServiceSupabase } from '../utils/supabaseAdmin.js'
import axios from 'axios'

const router = Router()

function normalizeMembersCount(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 500) return null
  return n
}

function normalizeMemberDetails(raw, limit = 500) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((m) => ({
      name: typeof m?.name === 'string' ? m.name.trim() : '',
      email: typeof m?.email === 'string' ? m.email.trim().toLowerCase() : '',
      role: typeof m?.role === 'string' ? m.role.trim() : '',
    }))
    .filter((m) => m.name || m.email || m.role)
    .slice(0, limit)
}

function normalizeDocuments(raw, limit = 50) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((d) => (typeof d === 'string' ? d.trim() : ''))
    .filter(Boolean)
    .slice(0, limit)
}

function userScopedSupabase(req) {
  const token = req.headers.authorization.split(' ')[1]
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })
}

/** Tries joins in order so we still return rows if some columns are missing in your DB. */
async function fetchStokvelMembers(userSupabase, stokvelId) {
  const { data, error } = await userSupabase
    .from('stokvel_members')
    .select('user_id, group_role, profiles(first_name, last_name)')
    .eq('stokvel_id', stokvelId)

  if (error) {
    console.error('fetchStokvelMembers error:', error.message)
    return { data: [], error }
  }

  return { data: data ?? [], error: null }
}

function toProfileMap(rows) {
  const map = new Map()
  for (const row of rows ?? []) {
    if (!row?.id) continue
    map.set(row.id, {
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? '',
    })
  }
  return map
}

function isPlatformAdmin(req) {
  return String(req.user?.role || '').toLowerCase() === 'admin'
}

async function getMembershipForStokvel(client, stokvelId, userId) {
  const { data, error } = await client
    .from('stokvel_members')
    .select('group_role')
    .eq('user_id', userId)
    .eq('stokvel_id', stokvelId)
    .maybeSingle()
  return { data, error }
}

async function requireStokvelAccess({ req, userSupabase, stokvelId }) {
  const platformAdmin = isPlatformAdmin(req)
  const reader = platformAdmin ? getServiceSupabase() ?? userSupabase : userSupabase
  const { data: membership, error } = await getMembershipForStokvel(reader, stokvelId, req.user.id)
  if (error) return { error, reader, membership: null }
  if (!membership && !platformAdmin) return { error: new Error('Not found'), reader, membership: null }
  return {
    error: null,
    reader,
    membership: membership ?? { group_role: 'admin' },
  }
}

function canManageMeetingsForGroup(membership) {
  return ['admin', 'treasurer'].includes(String(membership?.group_role || '').toLowerCase())
}
router.get('/', requireAuth, async (req, res) => {
  try {
    const userSupabase = userScopedSupabase(req)

    const { data, error } = await userSupabase
      .from('stokvel_members')
      .select('group_role, stokvels(*)')
      .eq('user_id', req.user.id)

    if (error) {
      console.error('GET /api/stokvels:', error)
      return res.status(500).json({ error: error.message })
    }

    res.json({ success: true, memberships: data })
  } catch (err) {
    console.error('GET /api/stokvels:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      name,
      contributionAmount,
      memberEmails,
      treasurerEmail,
      payoutOrder,
      meetingFrequency,
      membersCount,
      memberDetails,
      documents,
    } = req.body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Stokvel name is required' })
    }

    const userSupabase = userScopedSupabase(req)

    const parsedMembersCount = normalizeMembersCount(membersCount)
    const parsedDetails = normalizeMemberDetails(memberDetails, parsedMembersCount ?? 500)
    const parsedDocuments = normalizeDocuments(documents)
    const baseRow = {
      name: name.trim(),
      payout_order: typeof payoutOrder === 'string' ? payoutOrder : 'randomize',
      meeting_frequency: typeof meetingFrequency === 'string' ? meetingFrequency : 'monthly',
      members_count: parsedMembersCount,
      member_details: parsedDetails,
      documents: parsedDocuments,
    }
    const contributionNum = Number(contributionAmount)
    const includeContribution =
      contributionAmount !== '' &&
      contributionAmount != null &&
      !Number.isNaN(contributionNum)

    const row = includeContribution
      ? { ...baseRow, contribution_amount: contributionNum }
      : baseRow

    let { data: newStokvel, error: stokvelError } = await userSupabase
      .from('stokvels')
      .insert([row])
      .select()
      .single()

    if (
      stokvelError &&
      includeContribution &&
      String(stokvelError.message).includes('contribution_amount')
    ) {
      const retry = await userSupabase
        .from('stokvels')
        .insert([baseRow])
        .select()
        .single()
      newStokvel = retry.data
      stokvelError = retry.error
    }

    if (stokvelError) {
      console.error('POST /api/stokvels stokvels insert:', stokvelError)
      return res.status(500).json({
        error: stokvelError.message || 'Failed to create stokvel',
      })
    }

    const { error: memberError } = await userSupabase.from('stokvel_members').insert([
      {
        stokvel_id: newStokvel.id,
        user_id: req.user.id,
        group_role: 'treasurer',
      },
    ])

    if (memberError) {
      console.error('POST /api/stokvels stokvel_members insert:', memberError)
      return res.status(500).json({
        error: memberError.message || 'Failed to link creator to stokvel',
      })
    }

    const normalizedTreasurerEmail = normalizeInviteEmail(treasurerEmail)
    if (normalizedTreasurerEmail && normalizedTreasurerEmail !== normalizeInviteEmail(req.user.email)) {
      const writer = getServiceSupabase() ?? userSupabase
      const { error: treasurerInviteError } = await createInvitation(writer, {
        stokvelId: newStokvel.id,
        email: normalizedTreasurerEmail,
        invitedBy: req.user.id,
        status: 'pending_group_request',
        groupRole: 'treasurer',
      })
      if (treasurerInviteError) {
        return res.status(500).json({ error: treasurerInviteError.message })
      }
    }

    if (Array.isArray(memberEmails) && memberEmails.length > 0) {
      const writer = getServiceSupabase() ?? userSupabase
      const sanitized = [...new Set(memberEmails.map(normalizeInviteEmail).filter(Boolean))].slice(0, 50)
      for (const email of sanitized) {
        if (normalizedTreasurerEmail && email === normalizedTreasurerEmail) continue
        await createInvitation(writer, {
          stokvelId: newStokvel.id,
          email,
          invitedBy: req.user.id,
          status: 'pending_group_request',
        })
      }
    }

    res.status(201).json({ success: true, stokvel: newStokvel })
  } catch (err) {
    console.error('POST /api/stokvels:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id
    const userSupabase = userScopedSupabase(req)
    const access = await requireStokvelAccess({ req, userSupabase, stokvelId })
    if (access.error) {
      if (access.error.message === 'Not found') return res.status(404).json({ error: 'Not found' })
      console.error('GET /api/stokvels/:id membership:', access.error)
      return res.status(500).json({ error: access.error.message })
    }

    const { data: stokvel, error: stokvelError } = await access.reader
      .from('stokvels')
      .select('*')
      .eq('id', stokvelId)
      .single()

    if (stokvelError) {
      console.error('GET /api/stokvels/:id stokvel:', stokvelError)
      if (stokvelError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Not found' })
      }
      return res.status(500).json({ error: stokvelError.message })
    }

    const { data: members, error: membersError } = await fetchStokvelMembers(
      access.reader,
      stokvelId,
    )
    
    if (membersError) {
      console.error('GET /api/stokvels/:id members:', membersError)
      return res.status(500).json({ error: membersError.message })
    }
    
    const { data: contributions, error: contributionsError } = await access.reader
      .from('contributions')
      .select('id, amount, paid_at, user_id')
      .eq('stokvel_id', stokvelId)
      .order('paid_at', { ascending: false })
    
    if (contributionsError) {
      console.error('GET /api/stokvels/:id contributions:', contributionsError)
      return res.status(500).json({ error: contributionsError.message })
    }
    
    const contributorIds = [...new Set((contributions ?? []).map((c) => c.user_id).filter(Boolean))]
    let profileById = new Map()
    if (contributorIds.length > 0) {
      const { data: profileRows, error: profileError } = await access.reader
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', contributorIds)
      if (profileError) {
        console.error('GET /api/stokvels/:id contributor profiles:', profileError)
        return res.status(500).json({ error: profileError.message })
      }
      profileById = toProfileMap(profileRows)
    }

    const contributionsWithProfiles = (contributions ?? []).map((c) => ({
      ...c,
      profiles: profileById.get(c.user_id) ?? null,
    }))

    const totalContribution = contributionsWithProfiles.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    )
    
    res.json({
      success: true,
      membership: access.membership,
      stokvel,
      members: members ?? [],
      totalContribution,
      contributions: contributionsWithProfiles,
    })
  } catch (err) {
    console.error('GET /api/stokvels/:id:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.get('/:id/meetings', requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id
    const userSupabase = userScopedSupabase(req)
    const access = await requireStokvelAccess({ req, userSupabase, stokvelId })
    if (access.error) {
      if (access.error.message === 'Not found') return res.status(404).json({ error: 'Not found' })
      return res.status(500).json({ error: access.error.message })
    }

    const { data, error } = await access.reader
      .from('meetings')
      .select('id, stokvel_id, title, meeting_date, notes, meeting_link, agenda, minutes, created_at')
      .eq('stokvel_id', stokvelId)
      .order('meeting_date', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })

    return res.json({ success: true, meetings: data ?? [] })
  } catch (err) {
    console.error('GET /api/stokvels/:id/meetings:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.post('/:id/meetings', requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id
    const userSupabase = userScopedSupabase(req)
    const writer = getServiceSupabase() ?? userSupabase
    const { data: strictMembership, error: strictMembershipError } = await getMembershipForStokvel(
      userSupabase,
      stokvelId,
      req.user.id,
    )
    if (strictMembershipError) return res.status(500).json({ error: strictMembershipError.message })
    if (!strictMembership) return res.status(404).json({ error: 'Not found' })
    if (!canManageMeetingsForGroup(strictMembership)) {
      return res.status(403).json({ error: 'Only admin or treasurer can schedule meetings.' })
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
    const meetingDate = typeof req.body?.meetingDate === 'string' ? req.body.meetingDate.trim() : ''
    const meetingLink = typeof req.body?.meetingLink === 'string' ? req.body.meetingLink.trim() : ''
    const agenda = typeof req.body?.agenda === 'string' ? req.body.agenda.trim() : ''
    if (!title || !meetingDate) {
      return res.status(400).json({ error: 'Title and meeting date are required.' })
    }

    const { data: created, error: createError } = await writer
      .from('meetings')
      .insert({
        stokvel_id: stokvelId,
        title,
        meeting_date: meetingDate,
        meeting_link: meetingLink || null,
        agenda: agenda || null,
        notes: agenda || null,
        created_by: req.user.id,
      })
      .select('id, stokvel_id, title, meeting_date, notes, meeting_link, agenda, minutes, created_at')
      .single()
    if (createError) return res.status(500).json({ error: createError.message })

    const { data: stokvel } = await userSupabase
      .from('stokvels')
      .select('name')
      .eq('id', stokvelId)
      .maybeSingle()

    const { data: memberRows } = await userSupabase
      .from('stokvel_members')
      .select('user_id')
      .eq('stokvel_id', stokvelId)

    const memberIds = [...new Set((memberRows ?? []).map((m) => m.user_id).filter(Boolean))]
    if (memberIds.length > 0) {
      const { data: profiles } = await userSupabase
        .from('profiles')
        .select('id, email')
        .in('id', memberIds)
      const recipients = [...new Set((profiles ?? []).map((p) => normalizeInviteEmail(p.email)).filter(Boolean))]
      await Promise.all(
        recipients.map((to) =>
          sendMeetingScheduledEmail({
            to,
            groupName: stokvel?.name || 'Your stokvel',
            title: created.title,
            meetingDate: created.meeting_date,
            meetingLink: created.meeting_link,
            agenda: created.agenda || created.notes || '',
          }),
        ),
      )
    }

    return res.status(201).json({ success: true, meeting: created })
  } catch (err) {
    console.error('POST /api/stokvels/:id/meetings:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.patch('/:id/meetings/:meetingId', requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id
    const meetingId = req.params.meetingId
    const userSupabase = userScopedSupabase(req)
    const writer = getServiceSupabase() ?? userSupabase
    const { data: strictMembership, error: strictMembershipError } = await getMembershipForStokvel(
      userSupabase,
      stokvelId,
      req.user.id,
    )
    if (strictMembershipError) return res.status(500).json({ error: strictMembershipError.message })
    if (!strictMembership) return res.status(404).json({ error: 'Not found' })
    if (!canManageMeetingsForGroup(strictMembership)) {
      return res.status(403).json({ error: 'Only admin or treasurer can edit meetings.' })
    }

    const patch = {}
    if (typeof req.body?.title === 'string') patch.title = req.body.title.trim()
    if (typeof req.body?.meetingDate === 'string') patch.meeting_date = req.body.meetingDate.trim()
    if (typeof req.body?.meetingLink === 'string') patch.meeting_link = req.body.meetingLink.trim() || null
    if (typeof req.body?.agenda === 'string') {
      patch.agenda = req.body.agenda.trim() || null
      patch.notes = req.body.agenda.trim() || null
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided.' })
    }
    patch.updated_at = new Date().toISOString()

    const { data, error } = await writer
      .from('meetings')
      .update(patch)
      .eq('id', meetingId)
      .eq('stokvel_id', stokvelId)
      .select('id, stokvel_id, title, meeting_date, notes, meeting_link, agenda, minutes, created_at')
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Meeting not found.' })

    return res.json({ success: true, meeting: data })
  } catch (err) {
    console.error('PATCH /api/stokvels/:id/meetings/:meetingId:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.patch('/:id/meetings/:meetingId/minutes', requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id
    const meetingId = req.params.meetingId
    const userSupabase = userScopedSupabase(req)
    const writer = getServiceSupabase() ?? userSupabase
    const { data: strictMembership, error: strictMembershipError } = await getMembershipForStokvel(
      userSupabase,
      stokvelId,
      req.user.id,
    )
    if (strictMembershipError) return res.status(500).json({ error: strictMembershipError.message })
    if (!strictMembership) return res.status(404).json({ error: 'Not found' })
    if (!canManageMeetingsForGroup(strictMembership)) {
      return res.status(403).json({ error: 'Only admin or treasurer can record minutes.' })
    }

    const minutes = typeof req.body?.minutes === 'string' ? req.body.minutes.trim() : ''
    const { data, error } = await writer
      .from('meetings')
      .update({ minutes: minutes || null, updated_at: new Date().toISOString() })
      .eq('id', meetingId)
      .eq('stokvel_id', stokvelId)
      .select('id, stokvel_id, title, meeting_date, notes, meeting_link, agenda, minutes, created_at')
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Meeting not found.' })

    return res.json({ success: true, meeting: data })
  } catch (err) {
    console.error('PATCH /api/stokvels/:id/meetings/:meetingId/minutes:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.delete('/:id/meetings/:meetingId', requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id
    const meetingId = req.params.meetingId
    const userSupabase = userScopedSupabase(req)
    const writer = getServiceSupabase() ?? userSupabase
    const { data: strictMembership, error: strictMembershipError } = await getMembershipForStokvel(
      userSupabase,
      stokvelId,
      req.user.id,
    )
    if (strictMembershipError) return res.status(500).json({ error: strictMembershipError.message })
    if (!strictMembership) return res.status(404).json({ error: 'Not found' })
    if (!canManageMeetingsForGroup(strictMembership)) {
      return res.status(403).json({ error: 'Only this group admin or treasurer can delete meetings.' })
    }

    const { data, error } = await writer
      .from('meetings')
      .delete()
      .eq('id', meetingId)
      .eq('stokvel_id', stokvelId)
      .select('id')
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Meeting not found.' })
    return res.json({ success: true, meetingId })
  } catch (err) {
    console.error('DELETE /api/stokvels/:id/meetings/:meetingId:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.patch('/:id/treasurer', requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id
    const targetUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : ''
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user is required.' })
    }

    const userSupabase = userScopedSupabase(req)
    const writer = getServiceSupabase() ?? userSupabase

    const { data: requesterMembership, error: requesterMembershipError } = await userSupabase
      .from('stokvel_members')
      .select('group_role')
      .eq('stokvel_id', stokvelId)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (requesterMembershipError) {
      return res.status(500).json({ error: requesterMembershipError.message })
    }
    if (!requesterMembership) {
      return res.status(404).json({ error: 'Not found' })
    }
    if (!['admin', 'treasurer'].includes(requesterMembership.group_role)) {
      return res.status(403).json({ error: 'Only an admin or treasurer can change treasurer.' })
    }

    const { data: targetMembership, error: targetMembershipError } = await userSupabase
      .from('stokvel_members')
      .select('user_id')
      .eq('stokvel_id', stokvelId)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (targetMembershipError) {
      return res.status(500).json({ error: targetMembershipError.message })
    }
    if (!targetMembership) {
      return res.status(400).json({ error: 'Selected user is not a member of this stokvel.' })
    }

    const { error: demoteError } = await writer
      .from('stokvel_members')
      .update({ group_role: 'member' })
      .eq('stokvel_id', stokvelId)
      .eq('group_role', 'treasurer')
      .neq('user_id', targetUserId)
    if (demoteError) {
      return res.status(500).json({ error: demoteError.message })
    }

    const { error: assignError } = await writer
      .from('stokvel_members')
      .update({ group_role: 'treasurer' })
      .eq('stokvel_id', stokvelId)
      .eq('user_id', targetUserId)
    if (assignError) {
      return res.status(500).json({ error: assignError.message })
    }

    return res.json({ success: true, userId: targetUserId })
  } catch (err) {
    console.error('PATCH /api/stokvels/:id/treasurer:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.post('/:id/contributions', requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id
    const { amount } = req.body
    const parsed = Number(amount)

    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'A valid amount is required' })
    }

    const userSupabase = userScopedSupabase(req)

    // Verify user is a member
    const { data: membership, error: membershipError } = await userSupabase
      .from('stokvel_members')
      .select('group_role')
      .eq('user_id', req.user.id)
      .eq('stokvel_id', stokvelId)
      .maybeSingle()

    if (membershipError || !membership) {
      return res.status(403).json({ error: 'Not a member of this stokvel' })
    }

    const { data, error } = await userSupabase
      .from('contributions')
      .insert([{ stokvel_id: stokvelId, user_id: req.user.id, amount: parsed }])
      .select()
      .single()

    if (error) {
      console.error('POST contributions:', error)
      return res.status(500).json({ error: error.message })
    }

    res.status(201).json({ success: true, contribution: data })
  } catch (err) {
    console.error('POST contributions:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

// POST /api/stokvels/:id/payments/verify
router.post('/:id/payments/verify', requireAuth, async (req, res) => {
  try {
    const { reference, amount } = req.body
    const stokvel_id = req.params.id
    const user_id = req.user.id
    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ error: 'Payment reference is required.' })
    }

    let paystackResponse
    try {
      paystackResponse = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
      )
    } catch (verifyErr) {
      const paystackMessage =
        verifyErr?.response?.data?.message || verifyErr?.message || 'Paystack verification failed'
      console.error('POST payments/verify paystack error:', paystackMessage)
      return res.status(502).json({ error: `Paystack verify failed: ${paystackMessage}` })
    }
    const { data } = paystackResponse

    if (data.data.status !== 'success') {
      return res.status(400).json({ error: 'Payment not successful' })
    }

    const verified_amount = data.data.amount / 100

    const userSupabase = userScopedSupabase(req)
    const { data: contribution, error } = await userSupabase
      .from('contributions')
      .insert([{ stokvel_id, user_id, amount: verified_amount }])
      .select('id, stokvel_id, user_id, amount, paid_at')
      .single()

    if (error) return res.status(500).json({ error: error.message })

    res.json({ success: true, contribution })
  } catch (err) {
    console.error('POST payments/verify:', err)
    res.status(500).json({ error: 'Verification failed' })
  }
})

export default router
