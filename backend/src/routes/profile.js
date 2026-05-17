import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  getServiceSupabase,
  createUserJwtSupabase,
} from '../utils/supabaseAdmin.js'
import { sendSupabaseFailure } from '../utils/supabaseErrors.js'
import { normalizeUsername } from '../utils/username.js'

const router = Router()

function dbClient(req) {
  return getServiceSupabase() ?? createUserJwtSupabase(req, 'profile')
}

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!email) return ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

router.get('/me', requireAuth, async (req, res) => {
  try {
    const client = dbClient(req)
    if (!client) {
      sendSupabaseFailure(
        res,
        Object.assign(new Error('Supabase client unavailable'), {
          code: 'SUPABASE_CLIENT_UNAVAILABLE',
        }),
        'GET /api/profile/me',
      )
      return
    }
    const { data, error } = await client
      .from('profiles')
      .select('first_name, last_name, username, email')
      .eq('id', req.user.id)
      .maybeSingle()

    if (error) {
      sendSupabaseFailure(res, error, 'GET /api/profile/me')
      return
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
    sendSupabaseFailure(res, err, 'GET /api/profile/me')
  }
})

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const client = dbClient(req)
    if (!client) {
      sendSupabaseFailure(
        res,
        Object.assign(new Error('Supabase client unavailable'), {
          code: 'SUPABASE_CLIENT_UNAVAILABLE',
        }),
        'PATCH /api/profile/me',
      )
      return
    }
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
          sendSupabaseFailure(res, takenErr, 'PATCH /api/profile/me username check')
          return
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
      sendSupabaseFailure(res, exErr, 'PATCH /api/profile/me lookup')
      return
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
        sendSupabaseFailure(res, insErr, 'PATCH /api/profile/me insert')
        return
      }
    } else {
      const { error: upErr } = await client.from('profiles').update(updates).eq('id', req.user.id)
      if (upErr) {
        sendSupabaseFailure(res, upErr, 'PATCH /api/profile/me update')
        return
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
    sendSupabaseFailure(res, err, 'PATCH /api/profile/me')
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
      sendSupabaseFailure(res, error, 'GET /api/profile/username-available')
      return
    }

    return res.json({ available: !data })
  } catch (err) {
    console.error('GET /api/profile/username-available:', err)
    sendSupabaseFailure(res, err, 'GET /api/profile/username-available')
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
    if (!client) {
      sendSupabaseFailure(
        res,
        Object.assign(new Error('Supabase client unavailable'), {
          code: 'SUPABASE_CLIENT_UNAVAILABLE',
        }),
        'POST /api/profile/username',
      )
      return
    }

    const { data: taken, error: takenErr } = await client
      .from('profiles')
      .select('id')
      .eq('username', normalized)
      .neq('id', req.user.id)
      .maybeSingle()

    if (takenErr) {
      sendSupabaseFailure(res, takenErr, 'POST /api/profile/username taken check')
      return
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
      sendSupabaseFailure(res, exErr, 'POST /api/profile/username profile lookup')
      return
    }

    if (!existing) {
      const { error: insErr } = await client.from('profiles').insert({
        id: req.user.id,
        username: normalized,
        email: normalizeEmail(req.user.email) || null,
        role: 'user',
      })
      if (insErr) {
        sendSupabaseFailure(res, insErr, 'POST /api/profile/username insert')
        return
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
        sendSupabaseFailure(res, upErr, 'POST /api/profile/username update')
        return
      }
    }

    return res.json({ success: true, username: normalized })
  } catch (err) {
    console.error('POST /api/profile/username:', err)
    sendSupabaseFailure(res, err, 'POST /api/profile/username')
  }
})

export default router
