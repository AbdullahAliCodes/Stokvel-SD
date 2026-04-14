import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from './middleware/auth.js'
import stokvelsRouter from './routes/stokvels.js'
import adminStokvelsRouter from './routes/adminStokvels.js'
import profileRouter from './routes/profile.js'
import invitationsRouter from './routes/invitations.js'
import { getServiceSupabase } from './utils/supabaseAdmin.js'
import { ensurePlatformAdminsInStokvel } from './utils/platformAdminStokvelMembers.js'
import { createInvitation, normalizeInviteEmail } from './utils/invitations.js'

const app = express()
const PORT = Number(process.env.PORT) || 5000
const DASHBOARD_CACHE_TTL_MS = 30_000
const dashboardCache = new Map()

function hrNow() {
  return process.hrtime.bigint()
}

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1_000_000
}

function createUserSupabaseFromReq(req) {
  const token = req.headers.authorization.split(' ')[1]
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  )
}

function cacheKey(kind, userId) {
  return `${kind}:${userId}`
}

function readDashboardCache(kind, userId) {
  const key = cacheKey(kind, userId)
  const hit = dashboardCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.ts > DASHBOARD_CACHE_TTL_MS) {
    dashboardCache.delete(key)
    return null
  }
  return hit.payload
}

function writeDashboardCache(kind, userId, payload) {
  dashboardCache.set(cacheKey(kind, userId), { ts: Date.now(), payload })
}

function clearDashboardCacheForUser(userId) {
  dashboardCache.delete(cacheKey('my-stokvels', userId))
  dashboardCache.delete(cacheKey('my-meetings', userId))
}

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(typeof process.env.FRONTEND_URL === 'string'
    ? process.env.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean)
    : []),
].filter((origin, i, arr) => origin && arr.indexOf(origin) === i)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
  }),
)
app.use(express.json())

// Health Check Route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Stokvel API is running perfectly!',
    time: new Date().toISOString(),
  })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Stokvel API' })
})

app.use('/api/admin', adminStokvelsRouter)
app.use('/api/profile', profileRouter)
app.use('/api/invitations', invitationsRouter)

app.get('/api/me', requireAuth, (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    })
  } catch (err) {
    console.error('Route Error:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

app.get('/api/my-stokvels', requireAuth, async (req, res) => {
  const started = hrNow()
  try {
    const cached = readDashboardCache('my-stokvels', req.user.id)
    if (cached) {
      console.log(`[perf] GET /api/my-stokvels ${elapsedMs(started).toFixed(1)}ms (cache) user=${req.user.id}`)
      return res.json(cached)
    }

    const userSupabase = createUserSupabaseFromReq(req)

    const { data, error } = await userSupabase
      .from('stokvel_members')
      .select(
        'group_role, stokvels(id, name, status, contribution_amount, type, payout_strategy, cycle_length)',
      )
      .eq('user_id', req.user.id)

    if (error) {
      console.error('GET /api/my-stokvels:', error)
      return res.status(500).json({ error: error.message })
    }

    const memberships = (data ?? []).filter((row) => row?.stokvels?.id)

    const payload = { success: true, memberships }
    writeDashboardCache('my-stokvels', req.user.id, payload)
    res.json(payload)
    console.log(`[perf] GET /api/my-stokvels ${elapsedMs(started).toFixed(1)}ms user=${req.user.id}`)
  } catch (err) {
    console.error('GET /api/my-stokvels:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

app.get('/api/my-meetings', requireAuth, async (req, res) => {
  const started = hrNow()
  try {
    const cached = readDashboardCache('my-meetings', req.user.id)
    if (cached) {
      console.log(`[perf] GET /api/my-meetings ${elapsedMs(started).toFixed(1)}ms (cache) user=${req.user.id}`)
      return res.json(cached)
    }

    const userSupabase = createUserSupabaseFromReq(req)

    const { data: memberships, error: memberErr } = await userSupabase
      .from('stokvel_members')
      .select('stokvel_id')
      .eq('user_id', req.user.id)
    if (memberErr) {
      console.error('GET /api/my-meetings memberships:', memberErr)
      return res.status(500).json({ error: memberErr.message })
    }

    const stokvelIds = [...new Set((memberships ?? []).map((m) => m.stokvel_id).filter(Boolean))]
    if (stokvelIds.length === 0) {
      console.log(`[perf] GET /api/my-meetings ${elapsedMs(started).toFixed(1)}ms user=${req.user.id}`)
      return res.json({ success: true, meetings: [] })
    }

    const [meetingsRes, groupsRes] = await Promise.all([
      userSupabase
        .from('meetings')
        .select('id, stokvel_id, title, meeting_date, meeting_link, agenda, minutes, notes, created_at')
        .in('stokvel_id', stokvelIds)
        .order('meeting_date', { ascending: true }),
      userSupabase.from('stokvels').select('id, name').in('id', stokvelIds),
    ])

    if (meetingsRes.error) {
      console.error('GET /api/my-meetings meetings:', meetingsRes.error)
      return res.status(500).json({ error: meetingsRes.error.message })
    }
    if (groupsRes.error) {
      console.error('GET /api/my-meetings groups:', groupsRes.error)
      return res.status(500).json({ error: groupsRes.error.message })
    }

    const groupNameById = new Map((groupsRes.data ?? []).map((g) => [g.id, g.name || 'Unnamed group']))
    const meetings = (meetingsRes.data ?? []).map((m) => ({
      ...m,
      groupName: groupNameById.get(m.stokvel_id) || 'Unnamed group',
    }))

    console.log(
      `[perf] GET /api/my-meetings ${elapsedMs(started).toFixed(1)}ms user=${req.user.id} groups=${stokvelIds.length} meetings=${meetings.length}`,
    )
    const payload = { success: true, meetings }
    writeDashboardCache('my-meetings', req.user.id, payload)
    return res.json(payload)
  } catch (err) {
    console.error('GET /api/my-meetings:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

app.post('/api/stokvels', requireAuth, async (req, res) => {
  const started = hrNow()
  try {
    const userSupabase = createUserSupabaseFromReq(req)

    const { name, contributionAmount, meetingFrequency, payoutOrder, treasurerEmail } = req.body

    void contributionAmount
    void meetingFrequency
    void payoutOrder

    const { data: newStokvel, error: stokvelError } = await userSupabase
      .from('stokvels')
      .insert([{ name, status: 'pending' }])
      .select()
      .single()

    if (stokvelError) {
      console.error('stokvels insert:', stokvelError)
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
      console.error('stokvel_members insert:', memberError)
      return res.status(500).json({
        error: memberError.message || 'Failed to assign treasurer',
      })
    }

    const normalizedTreasurerEmail = normalizeInviteEmail(treasurerEmail)
    const creatorEmail = normalizeInviteEmail(req.user.email)
    if (normalizedTreasurerEmail && normalizedTreasurerEmail !== creatorEmail) {
      const writer = getServiceSupabase() ?? userSupabase
      const { error: treasurerInviteError } = await createInvitation(writer, {
        stokvelId: newStokvel.id,
        email: normalizedTreasurerEmail,
        invitedBy: req.user.id,
        status: 'pending_group_request',
        groupRole: 'treasurer',
      })
      if (treasurerInviteError) {
        console.error('treasurer invitation:', treasurerInviteError)
        return res.status(500).json({ error: treasurerInviteError.message })
      }
    }

    const svc = getServiceSupabase()
    if (svc) {
      const { error: syncErr } = await ensurePlatformAdminsInStokvel(svc, newStokvel.id)
      if (syncErr) {
        console.error('POST /api/stokvels platform admin sync:', syncErr)
        await userSupabase.from('stokvel_members').delete().eq('stokvel_id', newStokvel.id)
        await userSupabase.from('stokvels').delete().eq('id', newStokvel.id)
        return res.status(500).json({
          error:
            syncErr.message ||
            'Failed to add platform admins to the new group. Ensure stokvel_members allows group_role admin (see repo SQL migration).',
        })
      }
    } else {
      console.warn(
        'POST /api/stokvels: SUPABASE_SERVICE_ROLE_KEY not set; skipping auto-join for profiles.role=admin on new stokvels.',
      )
    }

    clearDashboardCacheForUser(req.user.id)
    res.status(201).json({ success: true, stokvel: newStokvel })
    console.log(`[perf] POST /api/stokvels ${elapsedMs(started).toFixed(1)}ms user=${req.user.id}`)
  } catch (err) {
    console.error('POST /api/stokvels:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

// GET /api/stokvels (list), GET /api/stokvels/:id, POST /api/stokvels/:id/contributions
app.use('/api/stokvels', stokvelsRouter)

app.listen(PORT, () => {
  console.log(`Stokvel API listening on port ${PORT}`)
})
