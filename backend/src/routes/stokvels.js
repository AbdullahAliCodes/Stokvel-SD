import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader.split(' ')[1]

    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    )

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

export default router
