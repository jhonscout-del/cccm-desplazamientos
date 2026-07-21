import { localDb, STATUS } from './localdb'
import { api } from './api'
import {
  enviarCorreoCheckin,
  enviarCorreoTrayecto,
  enviarCorreoCierre,
  enviarCorreoCierreTrayecto,
  enviarCorreoObservacionViaje,
  enviarCorreoObservacionTrayecto,
} from './email'

const nowIso = () => new Date().toISOString()

function toApiViaje(v) {
  return {
    id: v.id,
    nombre_reporta: v.nombreReporta,
    fecha_viaje: v.fechaViaje,
    fecha_reporte: v.fechaReporte,
    jefe_inmediato: v.jefeInmediato,
    area: v.area,
    origen: v.origen,
    destino: v.destino,
    transporte_tipo: v.transporteTipo,
    transporte_detalle: JSON.stringify(v.transporteDetalle || {}),
    hora_inicio: v.horaInicio,
    contacto_nombre: v.contactoNombre,
    correo_variable: v.correoVariable,
  }
}

function toApiTrayecto(t) {
  return {
    id: t.id,
    fecha_reporte: t.fechaReporte,
    jefe_inmediato: t.jefeInmediato,
    area: t.area,
    origen: t.origen,
    destino: t.destino,
    transporte: t.transporte,
    hora_salida: t.horaSalida,
    hora_llegada_estimada: t.horaLlegadaEstimada,
    contacto_emergencia: t.contactoEmergencia,
  }
}

function fromApiViaje(row, overrides = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    estado: row.estado,
    codigo: row.codigo,
    nombreReporta: row.nombre_reporta,
    fechaViaje: row.fecha_viaje,
    fechaReporte: row.fecha_reporte,
    jefeInmediato: row.jefe_inmediato,
    area: row.area,
    origen: row.origen,
    destino: row.destino,
    transporteTipo: row.transporte_tipo,
    transporteDetalle: row.transporte_detalle ? JSON.parse(row.transporte_detalle) : {},
    horaInicio: row.hora_inicio,
    contactoNombre: row.contacto_nombre,
    correoVariable: row.correo_variable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    syncStatus: STATUS.SYNCED,
    closeSyncStatus: row.estado === 'cerrado' ? STATUS.SYNCED : STATUS.NA,
    ...overrides,
  }
}

function fromApiTrayecto(row, overrides = {}) {
  return {
    id: row.id,
    viajeId: row.viaje_id,
    numero: row.numero,
    codigo: row.codigo,
    estado: row.estado,
    fechaReporte: row.fecha_reporte,
    jefeInmediato: row.jefe_inmediato,
    area: row.area,
    origen: row.origen,
    destino: row.destino,
    transporte: row.transporte,
    horaSalida: row.hora_salida,
    horaLlegadaEstimada: row.hora_llegada_estimada,
    contactoEmergencia: row.contacto_emergencia,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    syncStatus: STATUS.SYNCED,
    closeSyncStatus: row.estado === 'cerrado' ? STATUS.SYNCED : STATUS.NA,
    ...overrides,
  }
}

function fromApiObservacion(row, overrides = {}) {
  return {
    id: row.id,
    viajeId: row.viaje_id,
    trayectoId: row.trayecto_id,
    texto: row.texto,
    autor: row.autor,
    createdAt: row.created_at,
    syncStatus: STATUS.SYNCED,
    emailStatus: STATUS.SENT,
    ...overrides,
  }
}

export async function crearViajeLocal(user, data) {
  const viaje = {
    id: crypto.randomUUID(),
    userId: user.id,
    estado: 'abierto',
    codigo: null, // lo asigna el servidor al sincronizar
    ...data,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    closedAt: null,
    syncStatus: STATUS.PENDING,
    emailStatus: STATUS.PENDING,
    closeSyncStatus: STATUS.NA,
    closeEmailStatus: STATUS.NA,
  }
  await localDb.viajes.add(viaje)
  syncNow()
  return viaje
}

export async function agregarTrayectoLocal(viaje, data) {
  const existentes = await localDb.trayectos.where('viajeId').equals(viaje.id).count()
  const trayecto = {
    id: crypto.randomUUID(),
    viajeId: viaje.id,
    numero: existentes + 2, // el viaje principal cuenta como trayecto 1
    codigo: null, // se completa con "<codigo del viaje>-T<numero>" al sincronizar
    estado: 'abierto',
    ...data,
    createdAt: nowIso(),
    closedAt: null,
    syncStatus: STATUS.PENDING,
    emailStatus: STATUS.PENDING,
    closeSyncStatus: STATUS.NA,
    closeEmailStatus: STATUS.NA,
  }
  await localDb.trayectos.add(trayecto)
  syncNow()
  return trayecto
}

export async function cerrarViajeLocal(viaje) {
  await localDb.viajes.update(viaje.id, {
    estado: 'cerrado',
    closedAt: nowIso(),
    updatedAt: nowIso(),
    closeSyncStatus: STATUS.PENDING,
    closeEmailStatus: STATUS.PENDING,
  })
  syncNow()
}

export async function cerrarTrayectoLocal(trayecto) {
  await localDb.trayectos.update(trayecto.id, {
    estado: 'cerrado',
    closedAt: nowIso(),
    closeSyncStatus: STATUS.PENDING,
    closeEmailStatus: STATUS.PENDING,
  })
  syncNow()
}

// texto de una nota de seguimiento; trayecto opcional (null = observación
// del viaje principal). Solo debe llamarse mientras el viaje/trayecto siga
// abierto (la UI ya oculta el formulario en ese caso; el backend lo valida
// de nuevo por si acaso).
export async function agregarObservacionLocal(viaje, texto, trayecto = null) {
  const obs = {
    id: crypto.randomUUID(),
    viajeId: viaje.id,
    trayectoId: trayecto?.id ?? null,
    texto,
    autor: null,
    createdAt: nowIso(),
    syncStatus: STATUS.PENDING,
    emailStatus: STATUS.PENDING,
  }
  await localDb.observaciones.add(obs)
  syncNow()
  return obs
}

export function misViajes(userId) {
  return localDb.viajes.where('userId').equals(userId).reverse().sortBy('createdAt')
}

export async function viajeConTrayectos(id) {
  const viaje = await localDb.viajes.get(id)
  if (!viaje) return null
  const trayectos = await localDb.trayectos.where('viajeId').equals(id).sortBy('numero')
  return { viaje, trayectos }
}

export function observacionesDe(viajeId, trayectoId = null) {
  return localDb.observaciones
    .where('viajeId').equals(viajeId)
    .and((o) => (trayectoId ? o.trayectoId === trayectoId : !o.trayectoId))
    .sortBy('createdAt')
}

let syncing = false

// Empuja lo pendiente (creaciones, trayectos, cierres, observaciones) al
// backend y dispara los correos correspondientes. Es seguro llamarla
// repetidamente: cada paso solo actúa sobre registros que aún no están
// sincronizados/enviados.
export async function syncNow() {
  if (syncing) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  syncing = true
  try {
    const viajesPendientes = await localDb.viajes.where('syncStatus').equals(STATUS.PENDING).toArray()
    for (const v of viajesPendientes) {
      try {
        const data = await api.crearViaje(toApiViaje(v))
        await localDb.viajes.update(v.id, { syncStatus: STATUS.SYNCED, codigo: data.codigo })
      } catch {
        continue
      }
    }

    const necesitanEmailCheckin = await localDb.viajes
      .where('syncStatus').equals(STATUS.SYNCED)
      .and((v) => v.emailStatus === STATUS.PENDING || v.emailStatus === STATUS.ERROR)
      .toArray()
    for (const v of necesitanEmailCheckin) {
      try {
        await enviarCorreoCheckin(v, await observacionesDe(v.id))
        await localDb.viajes.update(v.id, { emailStatus: STATUS.SENT })
      } catch {
        await localDb.viajes.update(v.id, { emailStatus: STATUS.ERROR })
      }
    }

    const trayectosPendientes = await localDb.trayectos.where('syncStatus').equals(STATUS.PENDING).toArray()
    for (const t of trayectosPendientes) {
      const viaje = await localDb.viajes.get(t.viajeId)
      if (!viaje || viaje.syncStatus !== STATUS.SYNCED) continue
      try {
        const data = await api.crearTrayecto(t.viajeId, toApiTrayecto(t))
        const servTrayecto = data.trayectos.find((tr) => tr.id === t.id)
        await localDb.trayectos.update(t.id, { syncStatus: STATUS.SYNCED, codigo: servTrayecto?.codigo })
      } catch {
        continue
      }
    }

    const trayectosNecesitanEmail = await localDb.trayectos
      .where('syncStatus').equals(STATUS.SYNCED)
      .and((t) => t.emailStatus === STATUS.PENDING || t.emailStatus === STATUS.ERROR)
      .toArray()
    for (const t of trayectosNecesitanEmail) {
      const viaje = await localDb.viajes.get(t.viajeId)
      if (!viaje) continue
      try {
        await enviarCorreoTrayecto(viaje, t, await observacionesDe(viaje.id, t.id))
        await localDb.trayectos.update(t.id, { emailStatus: STATUS.SENT })
      } catch {
        await localDb.trayectos.update(t.id, { emailStatus: STATUS.ERROR })
      }
    }

    const obsPendientes = await localDb.observaciones.where('syncStatus').equals(STATUS.PENDING).toArray()
    for (const o of obsPendientes) {
      const viaje = await localDb.viajes.get(o.viajeId)
      if (!viaje || viaje.syncStatus !== STATUS.SYNCED) continue
      try {
        if (o.trayectoId) {
          const trayecto = await localDb.trayectos.get(o.trayectoId)
          if (!trayecto || trayecto.syncStatus !== STATUS.SYNCED) continue
          await api.agregarObservacionTrayecto(o.viajeId, o.trayectoId, { id: o.id, texto: o.texto })
        } else {
          await api.agregarObservacionViaje(o.viajeId, { id: o.id, texto: o.texto })
        }
        await localDb.observaciones.update(o.id, { syncStatus: STATUS.SYNCED })
      } catch {
        continue
      }
    }

    // Correo inmediato por cada observación nueva (no solo al cierre):
    // se envía una vez que la observación ya se sincronizó, con el
    // historial completo hasta ese momento.
    const obsNecesitanEmail = await localDb.observaciones
      .where('syncStatus').equals(STATUS.SYNCED)
      .and((o) => o.emailStatus === STATUS.PENDING || o.emailStatus === STATUS.ERROR)
      .toArray()
    for (const o of obsNecesitanEmail) {
      const viaje = await localDb.viajes.get(o.viajeId)
      if (!viaje) continue
      try {
        if (o.trayectoId) {
          const trayecto = await localDb.trayectos.get(o.trayectoId)
          if (!trayecto) continue
          await enviarCorreoObservacionTrayecto(viaje, trayecto, await observacionesDe(viaje.id, trayecto.id))
        } else {
          await enviarCorreoObservacionViaje(viaje, await observacionesDe(viaje.id))
        }
        await localDb.observaciones.update(o.id, { emailStatus: STATUS.SENT })
      } catch {
        await localDb.observaciones.update(o.id, { emailStatus: STATUS.ERROR })
      }
    }

    const cierresPendientes = await localDb.viajes.where('closeSyncStatus').equals(STATUS.PENDING).toArray()
    for (const v of cierresPendientes) {
      try {
        await api.cerrarViaje(v.id)
        await localDb.viajes.update(v.id, { closeSyncStatus: STATUS.SYNCED })
      } catch {
        continue
      }
    }

    const cierresNecesitanEmail = await localDb.viajes
      .where('closeSyncStatus').equals(STATUS.SYNCED)
      .and((v) => v.closeEmailStatus === STATUS.PENDING || v.closeEmailStatus === STATUS.ERROR)
      .toArray()
    for (const v of cierresNecesitanEmail) {
      try {
        await enviarCorreoCierre(v, await observacionesDe(v.id))
        await localDb.viajes.update(v.id, { closeEmailStatus: STATUS.SENT })
      } catch {
        await localDb.viajes.update(v.id, { closeEmailStatus: STATUS.ERROR })
      }
    }

    const cierresTrayectoPendientes = await localDb.trayectos.where('closeSyncStatus').equals(STATUS.PENDING).toArray()
    for (const t of cierresTrayectoPendientes) {
      try {
        await api.cerrarTrayecto(t.viajeId, t.id)
        await localDb.trayectos.update(t.id, { closeSyncStatus: STATUS.SYNCED })
      } catch {
        continue
      }
    }

    const cierresTrayectoNecesitanEmail = await localDb.trayectos
      .where('closeSyncStatus').equals(STATUS.SYNCED)
      .and((t) => t.closeEmailStatus === STATUS.PENDING || t.closeEmailStatus === STATUS.ERROR)
      .toArray()
    for (const t of cierresTrayectoNecesitanEmail) {
      const viaje = await localDb.viajes.get(t.viajeId)
      if (!viaje) continue
      try {
        await enviarCorreoCierreTrayecto(viaje, t, await observacionesDe(viaje.id, t.id))
        await localDb.trayectos.update(t.id, { closeEmailStatus: STATUS.SENT })
      } catch {
        await localDb.trayectos.update(t.id, { closeEmailStatus: STATUS.ERROR })
      }
    }
  } finally {
    syncing = false
  }
}

// Trae del servidor los viajes del usuario (por si otro dispositivo o el
// panel de control cerró/actualizó alguno) y los fusiona con la copia local.
export async function pullMisViajes() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  let data
  try {
    data = await api.listarViajes()
  } catch {
    return
  }
  for (const row of data.viajes) {
    const local = await localDb.viajes.get(row.id)
    if (local && local.syncStatus === STATUS.PENDING) continue // no pisar algo aún no confirmado
    await localDb.viajes.put(fromApiViaje(row, {
      emailStatus: local?.emailStatus ?? STATUS.SENT,
      closeEmailStatus: local?.closeEmailStatus ?? (row.estado === 'cerrado' ? STATUS.SENT : STATUS.NA),
    }))

    const full = await api.obtenerViaje(row.id).catch(() => null)
    if (!full) continue

    for (const orow of full.observaciones || []) {
      const localO = await localDb.observaciones.get(orow.id)
      if (localO && localO.syncStatus === STATUS.PENDING) continue
      await localDb.observaciones.put(fromApiObservacion(orow, { emailStatus: localO?.emailStatus ?? STATUS.SENT }))
    }

    for (const trow of full.trayectos) {
      const localT = await localDb.trayectos.get(trow.id)
      if (localT && localT.syncStatus === STATUS.PENDING) continue
      await localDb.trayectos.put(fromApiTrayecto(trow, {
        emailStatus: localT?.emailStatus ?? STATUS.SENT,
        closeEmailStatus: localT?.closeEmailStatus ?? (trow.estado === 'cerrado' ? STATUS.SENT : STATUS.NA),
      }))
      for (const orow of trow.observaciones || []) {
        const localO = await localDb.observaciones.get(orow.id)
        if (localO && localO.syncStatus === STATUS.PENDING) continue
        await localDb.observaciones.put(fromApiObservacion(orow, { emailStatus: localO?.emailStatus ?? STATUS.SENT }))
      }
    }
  }
}
