import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from './middleware/auth.js'
import stokvelsRouter from './routes/stokvels.js'

const app = express()
const PORT = Number(process.env.PORT) || 5000

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Stokvel API' })
})

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

app.use('/api/stokvels', stokvelsRouter)

app.get('/api/stokvels/:id', requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1]
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
      .eq('stokvel_id', req.params.id)
      .single()

    if (error) {
      console.error('GET /api/stokvels/:id:', error)
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Not found' })
      }
      return res.status(500).json({ error: error.message })
    }

    res.json({ success: true, membership: data })
  } catch (err) {
    console.error('GET /api/stokvels/:id:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

app.post('/api/stokvels', requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1]
    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    )

    const { name, contributionAmount, meetingFrequency, payoutOrder } = req.body

    void contributionAmount
    void meetingFrequency
    void payoutOrder

    const { data: newStokvel, error: stokvelError } = await userSupabase
      .from('stokvels')
      .insert([{ name }])
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

    res.status(201).json({ success: true, stokvel: newStokvel })
  } catch (err) {
    console.error('POST /api/stokvels:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

app.listen(PORT, () => {
  console.log(`Stokvel API listening on http://localhost:${PORT}`)
})
