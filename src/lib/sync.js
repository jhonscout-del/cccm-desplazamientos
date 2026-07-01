import { localDb, STATUS } from './localdb'
import { api } from './api'
import { enviarCorreoCheckin, enviarCorreoTrayecto, enviarCorreoCierre } from './email'

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
    syncStatus: STATUS.SYNCED,
    ...overrides,
  }
}

export async function crearViajeLocal(user, data) {
  const viaje = {
    id: crypto.randomUUID(),
    userId: user.id,
    estado: 'abierto',
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
    ...data,
    createdAt: nowIso(),
    syncStatus: STATUS.PENDING,
    emailStatus: STATUS.PENDING,
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

export function misViajes(userId) {
  return localDb.viajes.where('userId').equals(userId).reverse().sortBy('createdAt')
}

export async function viajeConTrayectos(id) {
  const viaje = await localDb.viajes.get(id)
  if (!viaje) return null
  const trayectos = await localDb.trayectos.where('viajeId').equals(id).sortBy('numero')
  return { viaje, trayectos }
}

let syncing = false

// Empuja lo pendiente (creaciones, trayectos, cierres) al backend y dispara
// los correos correspondientes. Es seguro llamarla repetidamente: cada paso
// solo actúa sobre registros que aún no están sincronizados/enviados.
export async function syncNow() {
  if (syncing) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  syncing = true
  try {
    const viajesPendientes = await localDb.viajes.where('syncStatus').equals(STATUS.PENDING).toArray()
    for (const v of viajesPendientes) {
      try {
        await api.crearViaje(toApiViaje(v))
        await localDb.viajes.update(v.id, { syncStatus: STATUS.SYNCED })
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
        await enviarCorreoCheckin(v)
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
        await api.crearTrayecto(t.viajeId, toApiTrayecto(t))
        await localDb.trayectos.update(t.id, { syncStatus: STATUS.SYNCED })
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
        await enviarCorreoTrayecto(viaje, t)
        await localDb.trayectos.update(t.id, { emailStatus: STATUS.SENT })
      } catch {
        await localDb.trayectos.update(t.id, { emailStatus: STATUS.ERROR })
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
        await enviarCorreoCierre(v)
        await localDb.viajes.update(v.id, { closeEmailStatus: STATUS.SENT })
      } catch {
        await localDb.viajes.update(v.id, { closeEmailStatus: STATUS.ERROR })
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
    for (const trow of full.trayectos) {
      const localT = await localDb.trayectos.get(trow.id)
      if (localT && localT.syncStatus === STATUS.PENDING) continue
      await localDb.trayectos.put(fromApiTrayecto(trow, { emailStatus: localT?.emailStatus ?? STATUS.SENT }))
    }
  }
}
