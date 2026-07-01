import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

export const viajesRouter = Router()
viajesRouter.use(requireAuth)

const VIAJE_FIELDS = [
  'nombre_reporta', 'fecha_viaje', 'fecha_reporte', 'jefe_inmediato', 'area',
  'origen', 'destino', 'transporte_tipo', 'transporte_detalle', 'hora_inicio',
  'contacto_nombre', 'correo_variable',
]

function withTrayectos(viaje) {
  const trayectos = db
    .prepare('SELECT * FROM trayectos WHERE viaje_id = ? ORDER BY numero ASC')
    .all(viaje.id)
  return { ...viaje, trayectos }
}

// Crear un viaje. El id lo genera el cliente (uuid) para que funcione offline
// y el registro se pueda crear localmente antes de tener conexión.
viajesRouter.post('/', (req, res) => {
  const { id } = req.body || {}
  if (!id) return res.status(400).json({ error: 'Falta id del viaje' })

  const existing = db.prepare('SELECT id FROM viajes WHERE id = ?').get(id)
  if (existing) {
    // Sync idempotente: si el cliente reenvía el mismo registro, no duplicar.
    return res.status(200).json(withTrayectos(db.prepare('SELECT * FROM viajes WHERE id = ?').get(id)))
  }

  const values = VIAJE_FIELDS.map((f) => req.body[f] ?? null)
  db.prepare(
    `INSERT INTO viajes (id, user_id, estado, ${VIAJE_FIELDS.join(', ')})
     VALUES (?, ?, 'abierto', ${VIAJE_FIELDS.map(() => '?').join(', ')})`,
  ).run(id, req.user.id, ...values)

  const viaje = db.prepare('SELECT * FROM viajes WHERE id = ?').get(id)
  res.status(201).json(withTrayectos(viaje))
})

// Listar viajes: un viajero ve solo los suyos, control ve todos.
viajesRouter.get('/', (req, res) => {
  const { estado } = req.query
  let rows
  if (req.user.role === 'control') {
    rows = estado
      ? db.prepare('SELECT * FROM viajes WHERE estado = ? ORDER BY created_at DESC').all(estado)
      : db.prepare('SELECT * FROM viajes ORDER BY created_at DESC').all()
  } else {
    rows = estado
      ? db.prepare('SELECT * FROM viajes WHERE user_id = ? AND estado = ? ORDER BY created_at DESC').all(req.user.id, estado)
      : db.prepare('SELECT * FROM viajes WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id)
  }
  res.json({ viajes: rows })
})

function loadViajeOr404(req, res) {
  const viaje = db.prepare('SELECT * FROM viajes WHERE id = ?').get(req.params.id)
  if (!viaje) {
    res.status(404).json({ error: 'Viaje no encontrado' })
    return null
  }
  if (req.user.role !== 'control' && viaje.user_id !== req.user.id) {
    res.status(403).json({ error: 'No autorizado' })
    return null
  }
  return viaje
}

viajesRouter.get('/:id', (req, res) => {
  const viaje = loadViajeOr404(req, res)
  if (!viaje) return
  res.json(withTrayectos(viaje))
})

// Cerrar un viaje: solo quien lo inició, o un usuario con rol "control".
viajesRouter.patch('/:id/cerrar', (req, res) => {
  const viaje = loadViajeOr404(req, res)
  if (!viaje) return
  if (viaje.estado === 'cerrado') {
    return res.status(200).json(withTrayectos(viaje))
  }

  db.prepare(
    `UPDATE viajes SET estado = 'cerrado', closed_at = datetime('now'), closed_by = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(req.user.id, viaje.id)

  res.json(withTrayectos(db.prepare('SELECT * FROM viajes WHERE id = ?').get(viaje.id)))
})

// Agregar un trayecto interno (ilimitados) a un viaje abierto.
viajesRouter.post('/:id/trayectos', (req, res) => {
  const viaje = loadViajeOr404(req, res)
  if (!viaje) return
  if (viaje.estado === 'cerrado') {
    return res.status(409).json({ error: 'El viaje ya está cerrado' })
  }

  const { id, fecha_reporte, jefe_inmediato, area, origen, destino, transporte, hora_salida, hora_llegada_estimada, contacto_emergencia } = req.body || {}
  if (!id) return res.status(400).json({ error: 'Falta id del trayecto' })

  const existing = db.prepare('SELECT id FROM trayectos WHERE id = ?').get(id)
  if (existing) {
    return res.status(200).json(withTrayectos(viaje))
  }

  const { numero } = db.prepare('SELECT COALESCE(MAX(numero), 1) + 1 AS numero FROM trayectos WHERE viaje_id = ?').get(viaje.id)

  db.prepare(
    `INSERT INTO trayectos (id, viaje_id, numero, fecha_reporte, jefe_inmediato, area, origen, destino, transporte, hora_salida, hora_llegada_estimada, contacto_emergencia)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, viaje.id, numero, fecha_reporte, jefe_inmediato, area, origen, destino, transporte, hora_salida, hora_llegada_estimada, contacto_emergencia)

  res.status(201).json(withTrayectos(db.prepare('SELECT * FROM viajes WHERE id = ?').get(viaje.id)))
})
