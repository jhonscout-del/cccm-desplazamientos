import { Router } from 'express'
import { db, nextViajeCodigo } from '../db.js'
import { requireAuth } from '../auth.js'
import { upsertViajeEnSharePoint, upsertTrayectoEnSharePoint } from '../graph.js'

export const viajesRouter = Router()
viajesRouter.use(requireAuth)

// Reflejar en SharePoint es "mejor esfuerzo": SQLite sigue siendo la fuente
// de verdad para la lógica de la app (quién puede cerrar qué, offline, etc.),
// así que un fallo de Graph no debe romper la respuesta al usuario.
function espejoSharePoint(promesa) {
  promesa.catch((err) => console.error('[SharePoint] fallo al sincronizar:', err.message))
}

function formatearObservaciones(rows) {
  return rows
    .map((o) => `[${o.created_at}]${o.autor ? ` ${o.autor}:` : ''} ${o.texto}`)
    .join('\n')
}

const VIAJE_FIELDS = [
  'nombre_reporta', 'fecha_viaje', 'fecha_reporte', 'jefe_inmediato', 'area',
  'origen', 'destino', 'transporte_tipo', 'transporte_detalle', 'hora_inicio',
  'contacto_nombre', 'correo_variable',
]

function observacionesDeViaje(viajeId) {
  return db
    .prepare('SELECT * FROM observaciones WHERE viaje_id = ? AND trayecto_id IS NULL ORDER BY created_at ASC')
    .all(viajeId)
}

function observacionesDeTrayecto(trayectoId) {
  return db.prepare('SELECT * FROM observaciones WHERE trayecto_id = ? ORDER BY created_at ASC').all(trayectoId)
}

function withDetalle(viaje) {
  const trayectos = db.prepare('SELECT * FROM trayectos WHERE viaje_id = ? ORDER BY numero ASC').all(viaje.id)
  return {
    ...viaje,
    observaciones: observacionesDeViaje(viaje.id),
    trayectos: trayectos.map((t) => ({ ...t, observaciones: observacionesDeTrayecto(t.id) })),
  }
}

function sincronizarViajeSharePoint(viaje) {
  espejoSharePoint(upsertViajeEnSharePoint(viaje, formatearObservaciones(observacionesDeViaje(viaje.id))))
}

function sincronizarTrayectoSharePoint(trayecto) {
  espejoSharePoint(upsertTrayectoEnSharePoint(trayecto, formatearObservaciones(observacionesDeTrayecto(trayecto.id))))
}

// Crear un viaje. El id lo genera el cliente (uuid) para que funcione offline
// y el registro se pueda crear localmente antes de tener conexión; el código
// legible (V-0001) lo asigna el servidor en el momento de sincronizar, que es
// el único lugar donde se puede garantizar que no se repita.
viajesRouter.post('/', (req, res) => {
  const { id } = req.body || {}
  if (!id) return res.status(400).json({ error: 'Falta id del viaje' })

  const existing = db.prepare('SELECT id FROM viajes WHERE id = ?').get(id)
  if (existing) {
    // Sync idempotente: si el cliente reenvía el mismo registro, no duplicar.
    return res.status(200).json(withDetalle(db.prepare('SELECT * FROM viajes WHERE id = ?').get(id)))
  }

  const values = VIAJE_FIELDS.map((f) => req.body[f] ?? null)
  db.prepare(
    `INSERT INTO viajes (id, user_id, estado, codigo, ${VIAJE_FIELDS.join(', ')})
     VALUES (?, ?, 'abierto', ?, ${VIAJE_FIELDS.map(() => '?').join(', ')})`,
  ).run(id, req.user.id, nextViajeCodigo(), ...values)

  const viaje = db.prepare('SELECT * FROM viajes WHERE id = ?').get(id)
  sincronizarViajeSharePoint(viaje)
  res.status(201).json(withDetalle(viaje))
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

function loadTrayectoOr404(req, res, viaje) {
  const trayecto = db
    .prepare('SELECT * FROM trayectos WHERE id = ? AND viaje_id = ?')
    .get(req.params.trayectoId, viaje.id)
  if (!trayecto) {
    res.status(404).json({ error: 'Trayecto no encontrado' })
    return null
  }
  return trayecto
}

viajesRouter.get('/:id', (req, res) => {
  const viaje = loadViajeOr404(req, res)
  if (!viaje) return
  res.json(withDetalle(viaje))
})

// Cerrar un viaje: solo quien lo inició, o un usuario con rol "control".
viajesRouter.patch('/:id/cerrar', (req, res) => {
  const viaje = loadViajeOr404(req, res)
  if (!viaje) return
  if (viaje.estado === 'cerrado') {
    return res.status(200).json(withDetalle(viaje))
  }

  db.prepare(
    `UPDATE viajes SET estado = 'cerrado', closed_at = datetime('now'), closed_by = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(req.user.id, viaje.id)

  const cerrado = db.prepare('SELECT * FROM viajes WHERE id = ?').get(viaje.id)
  sincronizarViajeSharePoint(cerrado)
  res.json(withDetalle(cerrado))
})

// Agregar una observación al viaje mientras siga abierto.
viajesRouter.post('/:id/observaciones', (req, res) => {
  const viaje = loadViajeOr404(req, res)
  if (!viaje) return
  if (viaje.estado === 'cerrado') {
    return res.status(409).json({ error: 'El viaje ya está cerrado, no admite más observaciones' })
  }

  const { id, texto } = req.body || {}
  if (!id || !texto) return res.status(400).json({ error: 'Falta id o texto de la observación' })

  const existing = db.prepare('SELECT id FROM observaciones WHERE id = ?').get(id)
  if (!existing) {
    db.prepare('INSERT INTO observaciones (id, viaje_id, trayecto_id, autor, texto) VALUES (?, ?, NULL, ?, ?)')
      .run(id, viaje.id, req.user.nombre, texto)
    sincronizarViajeSharePoint(viaje)
  }

  res.status(201).json(withDetalle(viaje))
})

// Agregar un trayecto interno (ilimitados) a un viaje abierto. El código
// queda ligado al del viaje (V-0001-T2), usando el mismo número de trayecto.
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
    return res.status(200).json(withDetalle(viaje))
  }

  const { numero } = db.prepare('SELECT COALESCE(MAX(numero), 1) + 1 AS numero FROM trayectos WHERE viaje_id = ?').get(viaje.id)
  const codigo = `${viaje.codigo}-T${numero}`

  db.prepare(
    `INSERT INTO trayectos (id, viaje_id, numero, codigo, fecha_reporte, jefe_inmediato, area, origen, destino, transporte, hora_salida, hora_llegada_estimada, contacto_emergencia)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, viaje.id, numero, codigo, fecha_reporte, jefe_inmediato, area, origen, destino, transporte, hora_salida, hora_llegada_estimada, contacto_emergencia)

  const trayecto = db.prepare('SELECT * FROM trayectos WHERE id = ?').get(id)
  sincronizarTrayectoSharePoint(trayecto)
  res.status(201).json(withDetalle(db.prepare('SELECT * FROM viajes WHERE id = ?').get(viaje.id)))
})

// Cerrar un trayecto puntual (no cierra el viaje completo).
viajesRouter.patch('/:id/trayectos/:trayectoId/cerrar', (req, res) => {
  const viaje = loadViajeOr404(req, res)
  if (!viaje) return
  const trayecto = loadTrayectoOr404(req, res, viaje)
  if (!trayecto) return
  if (trayecto.estado === 'cerrado') {
    return res.status(200).json(withDetalle(viaje))
  }

  db.prepare(`UPDATE trayectos SET estado = 'cerrado', closed_at = datetime('now'), closed_by = ? WHERE id = ?`)
    .run(req.user.id, trayecto.id)

  const cerrado = db.prepare('SELECT * FROM trayectos WHERE id = ?').get(trayecto.id)
  sincronizarTrayectoSharePoint(cerrado)
  res.status(200).json(withDetalle(viaje))
})

// Agregar una observación a un trayecto puntual mientras siga abierto.
viajesRouter.post('/:id/trayectos/:trayectoId/observaciones', (req, res) => {
  const viaje = loadViajeOr404(req, res)
  if (!viaje) return
  const trayecto = loadTrayectoOr404(req, res, viaje)
  if (!trayecto) return
  if (trayecto.estado === 'cerrado') {
    return res.status(409).json({ error: 'El trayecto ya está cerrado, no admite más observaciones' })
  }

  const { id, texto } = req.body || {}
  if (!id || !texto) return res.status(400).json({ error: 'Falta id o texto de la observación' })

  const existing = db.prepare('SELECT id FROM observaciones WHERE id = ?').get(id)
  if (!existing) {
    db.prepare('INSERT INTO observaciones (id, viaje_id, trayecto_id, autor, texto) VALUES (?, ?, ?, ?, ?)')
      .run(id, viaje.id, trayecto.id, req.user.nombre, texto)
    sincronizarTrayectoSharePoint(trayecto)
  }

  res.status(201).json(withDetalle(viaje))
})
