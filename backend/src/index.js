import 'dotenv/config'
import express from 'express'
import cors from 'cors'
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

app.listen(PORT, () => {
  console.log(`Stokvel API listening on http://localhost:${PORT}`)
})
