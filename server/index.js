import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import './db.js'
import { authRouter } from './routes/auth.js'
import { viajesRouter } from './routes/viajes.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/viajes', viajesRouter)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`))
