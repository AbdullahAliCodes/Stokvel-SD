import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

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
    const { name, contributionAmount } = req.body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Stokvel name is required' })
    }

    const userSupabase = userScopedSupabase(req)

    const baseRow = { name: name.trim() }
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

    const { data: membership, error: membershipError } = await userSupabase
      .from('stokvel_members')
      .select('group_role')
      .eq('user_id', req.user.id)
      .eq('stokvel_id', stokvelId)
      .maybeSingle()

    if (membershipError) {
      console.error('GET /api/stokvels/:id membership:', membershipError)
      return res.status(500).json({ error: membershipError.message })
    }

    if (!membership) {
      return res.status(404).json({ error: 'Not found' })
    }

    const { data: stokvel, error: stokvelError } = await userSupabase
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
      userSupabase,
      stokvelId,
    )
    
    if (membersError) {
      console.error('GET /api/stokvels/:id members:', membersError)
      return res.status(500).json({ error: membersError.message })
    }
    
    const { data: contributions, error: contributionsError } = await userSupabase
      .from('contributions')
      .select('id, amount, paid_at, user_id, profiles(first_name, last_name)')
      .eq('stokvel_id', stokvelId)
      .order('paid_at', { ascending: false })
    
    if (contributionsError) {
      console.error('GET /api/stokvels/:id contributions:', contributionsError)
      return res.status(500).json({ error: contributionsError.message })
    }
    
    const totalContribution = (contributions ?? []).reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    )
    
    res.json({
      success: true,
      membership,
      stokvel,
      members: members ?? [],
      totalContribution,
      contributions: contributions ?? [],
    })
  } catch (err) {
    console.error('GET /api/stokvels/:id:', err)
    res.status(500).json({ error: 'Internal Server Error' })
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

export default router
