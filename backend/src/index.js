import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = Number(process.env.PORT) || 5000

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Stokvel API' })
})

app.listen(PORT, () => {
  console.log(`Stokvel API listening on http://localhost:${PORT}`)
})
