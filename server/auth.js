import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export function signToken(user) {
  return jwt.sign(
    { id: user.id, nombre: user.nombre, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' },
  )
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
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
