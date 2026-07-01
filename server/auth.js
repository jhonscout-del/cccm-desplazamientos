import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { db } from './db.js'

const TENANT_ID = process.env.AZURE_TENANT_ID
const API_CLIENT_ID = process.env.AZURE_API_CLIENT_ID

const jwks = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  rateLimit: true,
})

function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(kid, (err, key) => {
      if (err) return reject(err)
      resolve(key.getPublicKey())
    })
  })
}

// Verifica el access token que MSAL emite en el navegador tras el login con
// la cuenta Microsoft/Office, y da de alta (o actualiza) al usuario local a
// partir de sus claims — ya no hay contraseñas ni registro manual.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  try {
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded) throw new Error('Token ilegible')

    const publicKey = await getSigningKey(decoded.header.kid)
    const claims = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
      audience: [API_CLIENT_ID, `api://${API_CLIENT_ID}`],
    })

    const nombre = claims.name || claims.preferred_username || 'Sin nombre'
    const email = claims.preferred_username || claims.email || ''

    let user = db.prepare('SELECT * FROM users WHERE azure_oid = ?').get(claims.oid)
    if (!user) {
      const info = db
        .prepare('INSERT INTO users (azure_oid, nombre, email, role) VALUES (?, ?, ?, ?)')
        .run(claims.oid, nombre, email, 'viajero')
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
    } else if (user.nombre !== nombre || user.email !== email) {
      db.prepare('UPDATE users SET nombre = ?, email = ? WHERE id = ?').run(nombre, email, user.id)
      user = { ...user, nombre, email }
    }

    req.user = { id: user.id, nombre: user.nombre, email: user.email, role: user.role }
    next()
  } catch (err) {
    res.status(401).json({ error: `Token inválido o expirado: ${err.message}` })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    next()
  }
}
