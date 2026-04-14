import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../middleware/auth.js'
import { getServiceSupabase } from '../utils/supabaseAdmin.js'
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

function dbClient(req) {
  return getServiceSupabase() ?? createUserScopedClient(req)
}

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!email) return ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

router.get('/me', requireAuth, async (req, res) => {
  try {
    const client = dbClient(req)
    const { data, error } = await client
      .from('profiles')
      .select('first_name, last_name, username, email')
      .eq('id', req.user.id)
      .maybeSingle()

    if (error) {
      console.error('GET /api/profile/me:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.json({
      success: true,
      profile: {
        firstName: data?.first_name ?? '',
        lastName: data?.last_name ?? '',
        username: data?.username ?? '',
        email: data?.email ?? req.user.email ?? '',
      },
    })
  } catch (err) {
    console.error('GET /api/profile/me:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const client = dbClient(req)
    const body = req.body ?? {}
    const updates = {}
    let touched = false

    if (typeof body.firstName === 'string') {
      updates.first_name = body.firstName.trim().slice(0, 120)
      touched = true
    }
    if (typeof body.lastName === 'string') {
      updates.last_name = body.lastName.trim().slice(0, 120)
      touched = true
    }
    if ('email' in body) {
      touched = true
      const normalized = normalizeEmail(body.email)
      if (!normalized) {
        return res.status(400).json({ error: 'Provide a valid email address.' })
      }
      updates.email = normalized
    }

    if ('username' in body) {
      touched = true
      if (body.username === null || body.username === '') {
        updates.username = null
      } else {
        const normalized = normalizeUsername(body.username)
        if (!normalized) {
          return res.status(400).json({
            error: 'Username must be 3–30 characters (letters, numbers, underscore only).',
          })
        }
        const { data: taken, error: takenErr } = await client
          .from('profiles')
          .select('id')
          .eq('username', normalized)
          .neq('id', req.user.id)
          .maybeSingle()
        if (takenErr) {
          console.error('PATCH /api/profile/me username check:', takenErr)
          return res.status(500).json({ error: takenErr.message })
        }
        if (taken) {
          return res.status(409).json({ error: 'That username is already taken.' })
        }
        updates.username = normalized
      }
    }

    if (!touched) {
      return res.status(400).json({
        error: 'Provide at least one field: firstName, lastName, username, or email.',
      })
    }

    updates.updated_at = new Date().toISOString()

    const { data: existing, error: exErr } = await client
      .from('profiles')
      .select('id')
      .eq('id', req.user.id)
      .maybeSingle()

    if (exErr) {
      console.error('PATCH /api/profile/me lookup:', exErr)
      return res.status(500).json({ error: exErr.message })
    }

    if (!existing) {
      const insertRow = {
        id: req.user.id,
        role: 'user',
        first_name: updates.first_name ?? null,
        last_name: updates.last_name ?? null,
        username: 'username' in body ? updates.username ?? null : null,
        email: updates.email ?? normalizeEmail(req.user.email) ?? null,
        updated_at: updates.updated_at,
      }
      const { error: insErr } = await client.from('profiles').insert(insertRow)
      if (insErr) {
        console.error('PATCH /api/profile/me insert:', insErr)
        return res.status(500).json({ error: insErr.message })
      }
    } else {
      const { error: upErr } = await client.from('profiles').update(updates).eq('id', req.user.id)
      if (upErr) {
        console.error('PATCH /api/profile/me update:', upErr)
        return res.status(500).json({ error: upErr.message })
      }
    }

    const { data: fresh, error: readErr } = await client
      .from('profiles')
      .select('first_name, last_name, username, email')
      .eq('id', req.user.id)
      .single()

    if (readErr) {
      return res.json({ success: true })
    }

    return res.json({
      success: true,
      profile: {
        firstName: fresh?.first_name ?? '',
        lastName: fresh?.last_name ?? '',
        username: fresh?.username ?? '',
        email: fresh?.email ?? req.user.email ?? '',
      },
    })
  } catch (err) {
    console.error('PATCH /api/profile/me:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

/** Public-ish check for signup (uses service role when configured). */
router.get('/username-available', async (req, res) => {
  try {
    const rawU = typeof req.query.u === 'string' ? req.query.u : ''
    const rawName = typeof req.query.username === 'string' ? req.query.username : ''
    const raw = rawU || rawName
    const normalized = normalizeUsername(typeof raw === 'string' ? raw : '')
    if (!normalized) {
      return res.json({ available: false, reason: 'invalid' })
    }

    const svc = getServiceSupabase()
    if (!svc) {
      return res.json({ available: null, skipped: true })
    }

    const { data, error } = await svc
      .from('profiles')
      .select('id')
      .eq('username', normalized)
      .maybeSingle()

    if (error) {
      console.error('GET /api/profile/username-available:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.json({ available: !data })
  } catch (err) {
    console.error('GET /api/profile/username-available:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.post('/username', requireAuth, async (req, res) => {
  try {
    const normalized = normalizeUsername(req.body?.username)
    if (!normalized) {
      return res.status(400).json({
        error: 'Username must be 3–30 characters (letters, numbers, underscore only).',
      })
    }

    const client = dbClient(req)

    const { data: taken, error: takenErr } = await client
      .from('profiles')
      .select('id')
      .eq('username', normalized)
      .neq('id', req.user.id)
      .maybeSingle()

    if (takenErr) {
      console.error('POST /api/profile/username taken check:', takenErr)
      return res.status(500).json({ error: takenErr.message })
    }

    if (taken) {
      return res.status(409).json({ error: 'That username is already taken.' })
    }

    const { data: existing, error: exErr } = await client
      .from('profiles')
      .select('id')
      .eq('id', req.user.id)
      .maybeSingle()

    if (exErr) {
      console.error('POST /api/profile/username profile lookup:', exErr)
      return res.status(500).json({ error: exErr.message })
    }

    if (!existing) {
      const { error: insErr } = await client.from('profiles').insert({
        id: req.user.id,
        username: normalized,
        email: normalizeEmail(req.user.email) || null,
        role: 'user',
      })
      if (insErr) {
        console.error('POST /api/profile/username insert:', insErr)
        return res.status(500).json({ error: insErr.message || 'Failed to create profile' })
      }
    } else {
      const { error: upErr } = await client
        .from('profiles')
        .update({
          username: normalized,
          email: normalizeEmail(req.user.email) || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.user.id)
      if (upErr) {
        console.error('POST /api/profile/username update:', upErr)
        return res.status(500).json({ error: upErr.message || 'Failed to save username' })
      }
    }

    return res.json({ success: true, username: normalized })
  } catch (err) {
    console.error('POST /api/profile/username:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

export default router
