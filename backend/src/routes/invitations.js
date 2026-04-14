import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../middleware/auth.js'
import { getServiceSupabase } from '../utils/supabaseAdmin.js'
import { groupRoleForUserProfile } from '../utils/platformAdminStokvelMembers.js'
import { normalizeInviteEmail } from '../utils/invitations.js'

const router = Router()

function createUserScopedClient(req) {
  const token = req.headers.authorization.split(' ')[1]
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })
}

function dbClient(req) {
  return getServiceSupabase() ?? createUserScopedClient(req)
}

router.get('/:token', async (req, res) => {
  try {
    const token = typeof req.params.token === 'string' ? req.params.token.trim() : ''
    if (!token) return res.status(400).json({ error: 'Invitation token is required.' })

    const svc = getServiceSupabase()
    if (!svc) return res.status(500).json({ error: 'Server missing service role configuration.' })

    const { data, error } = await svc
      .from('invitations')
      .select('id, status, email, stokvels(id, name, status)')
      .eq('token', token)
      .maybeSingle()

    if (error) return res.status(500).json({ error: error.message })
    if (!data || data.status !== 'pending') return res.status(404).json({ error: 'Invitation not found.' })

    return res.json({
      success: true,
      invitation: {
        email: data.email,
        stokvel: data.stokvels ?? null,
      },
    })
  } catch (err) {
    console.error('GET /api/invitations/:token:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.post('/accept', requireAuth, async (req, res) => {
  try {
    const client = dbClient(req)
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    if (!token) return res.status(400).json({ error: 'Invitation token is required.' })

    const { data: invite, error: inviteError } = await client
      .from('invitations')
      .select('id, email, status, stokvel_id, group_role')
      .eq('token', token)
      .maybeSingle()
    if (inviteError) return res.status(500).json({ error: inviteError.message })
    if (!invite || invite.status !== 'pending') return res.status(404).json({ error: 'Invitation not found.' })

    const inviteEmail = normalizeInviteEmail(invite.email)
    const authEmail = normalizeInviteEmail(req.user.email)

    const { data: profile } = await client
      .from('profiles')
      .select('email')
      .eq('id', req.user.id)
      .maybeSingle()
    const profileEmail = normalizeInviteEmail(profile?.email)

    if (inviteEmail && inviteEmail !== authEmail && inviteEmail !== profileEmail) {
      return res.status(403).json({ error: 'This invitation belongs to another email address.' })
    }

    const invitedRole =
      typeof invite.group_role === 'string' && invite.group_role.trim()
        ? invite.group_role.trim().toLowerCase()
        : null
    const role = invitedRole || (await groupRoleForUserProfile(client, req.user.id))
    const { error: memberError } = await client.from('stokvel_members').upsert(
      {
        stokvel_id: invite.stokvel_id,
        user_id: req.user.id,
        group_role: role,
      },
      { onConflict: 'stokvel_id,user_id' },
    )
    if (memberError) return res.status(500).json({ error: memberError.message })

    const { error: upErr } = await client
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invite.id)
    if (upErr) return res.status(500).json({ error: upErr.message })

    return res.json({ success: true })
  } catch (err) {
    console.error('POST /api/invitations/accept:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

export default router
