import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { signToken, requireAuth } from '../auth.js'

export const authRouter = Router()

authRouter.post('/register', (req, res) => {
  const { nombre, email, password } = req.body || {}
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
  if (exists) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' })

  const password_hash = bcrypt.hashSync(password, 10)
  const info = db
    .prepare('INSERT INTO users (nombre, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(nombre, email.toLowerCase(), password_hash, 'viajero')

  const user = db.prepare('SELECT id, nombre, email, role FROM users WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json({ user, token: signToken(user) })
})

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' })

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase())
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }
  const user = { id: row.id, nombre: row.nombre, email: row.email, role: row.role }
  res.json({ user, token: signToken(user) })
})

authRouter.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, nombre, email, role FROM users WHERE id = ?').get(req.user.id)
  if (!row) return res.status(404).json({ error: 'Usuario no encontrado' })
  res.json({ user: row })
})
