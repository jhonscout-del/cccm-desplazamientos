import Dexie from 'dexie'

// Base de datos local (IndexedDB) para que la app funcione sin conexión.
// Cada registro guarda su propio estado de sincronización y de envío de
// correo, para que la cola de sincronización sepa qué falta por hacer.
export const localDb = new Dexie('cccm_desplazamientos')

localDb.version(1).stores({
  viajes:
    'id, userId, estado, syncStatus, emailStatus, closeSyncStatus, closeEmailStatus, createdAt',
  trayectos: 'id, viajeId, syncStatus, emailStatus, createdAt',
})

localDb.version(2).stores({
  viajes:
    'id, userId, estado, syncStatus, emailStatus, closeSyncStatus, closeEmailStatus, createdAt',
  trayectos:
    'id, viajeId, estado, syncStatus, emailStatus, closeSyncStatus, closeEmailStatus, createdAt',
  observaciones: 'id, viajeId, trayectoId, syncStatus, createdAt',
})

export const STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  SENT: 'sent',
  ERROR: 'error',
  NA: 'na',
}
