import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from './middleware/auth.js'
import stokvelsRouter from './routes/stokvels.js'
import adminStokvelsRouter from './routes/adminStokvels.js'
import profileRouter from './routes/profile.js'
import invitationsRouter from './routes/invitations.js'
import { getServiceSupabase } from './utils/supabaseAdmin.js'
import {
  ensurePlatformAdminsInStokvel,
  normalizeUuid,
} from './utils/platformAdminStokvelMembers.js'
import {
  createInvitation,
  normalizeInviteEmail,
  sendInvitationEmail,
} from './utils/invitations.js'
import cron from 'node-cron'
import { fetchRepoRateFromFred } from './jobs/fetchRates.js'
import marketRatesRouter from './routes/marketRates.js'
import { searchProfilesForMemberInvite } from './utils/profileUserSearch.js'

const app = express()
const PORT = Number(process.env.PORT) || 5000
const DASHBOARD_CACHE_TTL_MS = 30_000
const dashboardCache = new Map()
const DOCUMENTS_BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || 'stokvel-documents'
const documentsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
})

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

function normalizeMembersCount(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 500) return null
  return n
}

const UUID_RE_MEMBER_DETAILS =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeMemberDetails(raw, limit = 500) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((m) => {
      const maybeUid = typeof m?.userId === 'string' ? m.userId.trim() : ''
      const userId =
        UUID_RE_MEMBER_DETAILS.test(maybeUid) ? maybeUid.trim().toLowerCase() : ''
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

function normalizeDocuments(raw, limit = 50) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((d) => (typeof d === 'string' ? d.trim() : ''))
    .filter(Boolean)
    .slice(0, limit)
}

function normalizeTreasurerUserIdMember(raw) {
  if (typeof raw !== 'string') return ''
  const v = raw.trim().toLowerCase()
  return UUID_RE_MEMBER_DETAILS.test(v) ? v : ''
}

function normalizeInitialMemberIds(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  for (const id of raw) {
    if (typeof id !== 'string') continue
    const v = id.trim().toLowerCase()
    if (!UUID_RE_MEMBER_DETAILS.test(v)) continue
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
    if (out.length >= 500) break
  }
  return out
}

function collectUuidsFromMemberDetails(details) {
  const out = []
  const seen = new Set()
  for (const row of details ?? []) {
    const uid = row?.userId
    if (typeof uid !== 'string' || !UUID_RE_MEMBER_DETAILS.test(uid.trim())) continue
    const v = uid.trim().toLowerCase()
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

/** Deletes invitations, memberships, then the stokvel (service role — bypasses RLS). */
async function deleteStokvelCascade(svc, stokvelId) {
  const { error: e1 } = await svc.from('invitations').delete().eq('stokvel_id', stokvelId)
  if (e1) console.error('deleteStokvelCascade invitations:', e1)
  const { error: e2 } = await svc.from('stokvel_members').delete().eq('stokvel_id', stokvelId)
  if (e2) console.error('deleteStokvelCascade stokvel_members:', e2)
  const { error: e3 } = await svc.from('stokvels').delete().eq('id', stokvelId)
  if (e3) console.error('deleteStokvelCascade stokvels:', e3)
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

function safeFileName(name) {
  return String(name || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

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

app.post('/api/uploads/documents', requireAuth, (req, res) => {
  documentsUpload.array('documents', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' })
    }
    try {
      const svc = getServiceSupabase()
      if (!svc) {
        return res.status(500).json({
          error: 'Document upload requires SUPABASE_SERVICE_ROLE_KEY on the API server.',
        })
      }
      const files = Array.isArray(req.files) ? req.files : []
      if (files.length === 0) {
        return res.status(400).json({ error: 'Select at least one document.' })
      }

      const { error: bucketError } = await svc.storage.createBucket(DOCUMENTS_BUCKET, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
      })
      if (bucketError && !String(bucketError.message || '').toLowerCase().includes('already')) {
        return res.status(500).json({ error: bucketError.message })
      }

      const uploaded = []
      for (const file of files) {
        const stamp = Date.now()
        const key = `${req.user.id}/${stamp}-${Math.random().toString(36).slice(2, 8)}-${safeFileName(file.originalname)}`
        const { error: uploadError } = await svc.storage
          .from(DOCUMENTS_BUCKET)
          .upload(key, file.buffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: false,
          })
        if (uploadError) {
          return res.status(500).json({ error: uploadError.message })
        }
        const { data: pub } = svc.storage.from(DOCUMENTS_BUCKET).getPublicUrl(key)
        uploaded.push(pub?.publicUrl || key)
      }

      return res.status(201).json({ success: true, documents: uploaded })
    } catch (uploadErr) {
      console.error('POST /api/uploads/documents:', uploadErr)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  })
})

app.use('/api/admin', adminStokvelsRouter)
app.use('/api/profile', profileRouter)
app.use('/api/invitations', invitationsRouter)
app.use('/api/market-rates', marketRatesRouter)
app.use('/api/v1/market-rates', marketRatesRouter)

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
        'stokvel_id, group_role, stokvels(id, name, status, contribution_amount, type, payout_strategy, cycle_length)',
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

app.get('/api/users', requireAuth, searchProfilesForMemberInvite)

app.post('/api/stokvels', requireAuth, async (req, res) => {
  const started = hrNow()
  try {
    const userSupabase = createUserSupabaseFromReq(req)

    const {
      name,
      type,
      contributionAmount,
      meetingFrequency,
      payoutOrder,
      payoutStrategy,
      cycleLength,
      treasurerUserId: treasurerUserIdRaw,
      initialMemberIds: initialMemberIdsRaw,
      membersCount,
      memberDetails,
      documents,
    } = req.body ?? {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required.' })
    }

    const creatorEmailNorm = normalizeInviteEmail(req.user.email)
    const creatorId = normalizeUuid(req.user.id)
    if (!creatorId) {
      return res.status(400).json({ error: 'Invalid authenticated user id.' })
    }

    const parsedMembersCount = normalizeMembersCount(membersCount)
    if (!parsedMembersCount || parsedMembersCount < 2) {
      return res.status(400).json({
        error:
          'The group must include at least two people (you plus at least one other member).',
      })
    }

    const treasurerUuidRaw = normalizeTreasurerUserIdMember(treasurerUserIdRaw)
    if (!treasurerUuidRaw) {
      return res.status(400).json({
        error: 'A registered user must be selected as the Treasurer.',
      })
    }
    const treasurerUuid = normalizeUuid(treasurerUuidRaw)
    if (!treasurerUuid) {
      return res.status(400).json({
        error: 'A registered user must be selected as the Treasurer.',
      })
    }
    if (treasurerUuid === creatorId) {
      return res.status(400).json({ error: 'You cannot designate yourself as treasurer.' })
    }

    const parsedDetails = normalizeMemberDetails(memberDetails, parsedMembersCount ?? 500)
    const parsedDocuments = normalizeDocuments(documents)
    const insertRow = {
      name: name.trim(),
      status: 'pending',
      contribution_amount: Number(contributionAmount) || 0,
      payout_order: typeof payoutOrder === 'string' ? payoutOrder : 'randomize',
      meeting_frequency: typeof meetingFrequency === 'string' ? meetingFrequency : 'monthly',
      members_count: parsedMembersCount,
      member_details: parsedDetails,
      documents: parsedDocuments,
    }
    if (typeof type === 'string' && (type === 'Rotating' || type === 'Fixed')) {
      insertRow.type = type
    }
    if (
      typeof payoutStrategy === 'string' &&
      (payoutStrategy === 'Manual' || payoutStrategy === 'Auto-Rotate')
    ) {
      insertRow.payout_strategy = payoutStrategy
    }
    const cyc = Number(cycleLength)
    if (Number.isInteger(cyc) && cyc >= 1 && cyc <= 240) {
      insertRow.cycle_length = cyc
    }

    const { data: newStokvel, error: stokvelError } = await userSupabase
      .from('stokvels')
      .insert([insertRow])
      .select()
      .single()

    if (stokvelError) {
      console.error('stokvels insert:', stokvelError)
      return res.status(500).json({
        error: stokvelError.message || 'Failed to create stokvel',
      })
    }

    const stokvelId = newStokvel.id

    /** Creator is always group admin (chairperson); UUID canonicalized so later dedupe matches. */
    const { error: creatorMemberErr } = await userSupabase.from('stokvel_members').insert([
      {
        stokvel_id: stokvelId,
        user_id: creatorId,
        group_role: 'admin',
      },
    ])

    if (creatorMemberErr) {
      console.error('stokvel_members creator insert:', creatorMemberErr)
      await userSupabase.from('stokvels').delete().eq('id', stokvelId)
      return res.status(500).json({
        error: creatorMemberErr.message || 'Failed to assign creator as group admin.',
      })
    }

    const svc = getServiceSupabase()
    if (!svc) {
      console.error('POST /api/stokvels: SUPABASE_SERVICE_ROLE_KEY required for SoD member setup.')
      await userSupabase.from('stokvel_members').delete().eq('stokvel_id', stokvelId)
      await userSupabase.from('stokvels').delete().eq('id', stokvelId)
      return res.status(500).json({
        error:
          'Server configuration error: cannot complete group membership (missing service role key).',
      })
    }

    const initialIdsList = normalizeInitialMemberIds(initialMemberIdsRaw)
    const detailUuids = collectUuidsFromMemberDetails(parsedDetails)
    const mergedMemberUuids = [...new Set([...initialIdsList, ...detailUuids])]

    const handledUserIds = new Set([creatorId])
    const handledEmails = new Set()
    if (creatorEmailNorm) handledEmails.add(creatorEmailNorm)

    try {
      handledUserIds.add(treasurerUuid)
      const { error: te } = await svc.from('stokvel_members').insert([
        {
          stokvel_id: stokvelId,
          user_id: treasurerUuid,
          group_role: 'treasurer',
        },
      ])
      if (te) throw te

      const { data: tp } = await svc
        .from('profiles')
        .select('email')
        .eq('id', treasurerUuid)
        .maybeSingle()
      const pem = normalizeInviteEmail(tp?.email)
      if (pem) handledEmails.add(pem)

      for (const rawUid of mergedMemberUuids) {
        const uid = normalizeUuid(rawUid)
        if (!uid || uid === creatorId) continue
        if (!UUID_RE_MEMBER_DETAILS.test(uid)) continue
        if (handledUserIds.has(uid)) continue
        const { error: me } = await svc.from('stokvel_members').insert([
          {
            stokvel_id: stokvelId,
            user_id: uid,
            group_role: 'member',
          },
        ])
        if (me) throw me
        handledUserIds.add(uid)

        const { data: prof } = await svc
          .from('profiles')
          .select('email')
          .eq('id', uid)
          .maybeSingle()
        const em = normalizeInviteEmail(prof?.email)
        if (em) handledEmails.add(em)
      }

      for (const row of parsedDetails) {
        const em = normalizeInviteEmail(row.email)
        if (!em) continue
        if (handledEmails.has(em)) continue
        if (row.userId && UUID_RE_MEMBER_DETAILS.test(String(row.userId).trim())) continue

        if (em === creatorEmailNorm) continue

        const { data: invRow, error: invErr } = await createInvitation(svc, {
          stokvelId,
          email: em,
          invitedBy: req.user.id,
          status: 'pending',
          groupRole: 'member',
        })
        if (invErr) throw invErr
        if (invRow?.token) {
          await sendInvitationEmail({
            to: em,
            groupName: newStokvel.name,
            token: invRow.token,
          })
        }
        handledEmails.add(em)
      }

      const { error: syncErr } = await ensurePlatformAdminsInStokvel(svc, stokvelId)
      if (syncErr) throw syncErr
    } catch (pipelineErr) {
      console.error('POST /api/stokvels membership pipeline:', pipelineErr)
      await deleteStokvelCascade(svc, stokvelId)
      return res.status(500).json({
        error:
          pipelineErr?.message ||
          String(pipelineErr) ||
          'Failed to complete group membership setup.',
      })
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

  if (process.env.FRED_API_KEY?.trim()) {
    cron.schedule(
      '0 6 * * *',
      () => {
        void fetchRepoRateFromFred()
      },
      { timezone: 'Africa/Johannesburg' },
    )
    console.log(
      '[FRED] Scheduled daily SA policy rate sync (06:00 Africa/Johannesburg)',
    )
    void fetchRepoRateFromFred()
  } else {
    console.warn(
      '[FRED] FRED_API_KEY not set; market_data will not auto-sync (set key in .env)',
    )
  }
})
