// Ejecutar después de configurar AZURE_TENANT_ID, AZURE_GRAPH_CLIENT_ID,
// AZURE_GRAPH_CLIENT_SECRET y SHAREPOINT_SITE_ID en .env, para crear (o
// actualizar) las dos listas de SharePoint con sus columnas. Es seguro
// volver a correrlo: si la lista ya existe, solo agrega las columnas que
// falten. Al final imprime los IDs que debes copiar en
// SHAREPOINT_LIST_VIAJES_ID y SHAREPOINT_LIST_TRAYECTOS_ID.
//
// Uso: node server/scripts/provisionSharePoint.js

import 'dotenv/config'
import { graphFetchDirect } from '../graph.js'

const SITE_ID = process.env.SHAREPOINT_SITE_ID
if (!SITE_ID) throw new Error('Falta SHAREPOINT_SITE_ID en .env')

const texto = (name, opts = {}, extra = {}) => ({
  name,
  text: { allowMultipleLines: false, maxLength: 255, ...opts },
  ...extra,
})
const numero = (name) => ({ name, number: {} })

async function asegurarColumnas(listId, columns) {
  const existentes = await graphFetchDirect(`/sites/${SITE_ID}/lists/${listId}/columns`)
  const nombresExistentes = new Set(existentes.value.map((c) => c.name))
  for (const columna of columns) {
    if (nombresExistentes.has(columna.name)) continue
    await graphFetchDirect(`/sites/${SITE_ID}/lists/${listId}/columns`, {
      method: 'POST',
      body: JSON.stringify(columna),
    })
    console.log(`  + columna agregada: ${columna.name}`)
  }
}

async function crearListaSiNoExiste(displayName, columns) {
  const existentes = await graphFetchDirect(`/sites/${SITE_ID}/lists?$filter=displayName eq '${displayName}'`)
  if (existentes.value?.length) {
    const id = existentes.value[0].id
    console.log(`Ya existe "${displayName}" -> id: ${id}`)
    await asegurarColumnas(id, columns)
    return id
  }

  const creada = await graphFetchDirect(`/sites/${SITE_ID}/lists`, {
    method: 'POST',
    body: JSON.stringify({ displayName, list: { template: 'genericList' }, columns }),
  })
  console.log(`Creada "${displayName}" -> id: ${creada.id}`)
  return creada.id
}

const idViajes = await crearListaSiNoExiste('ViajesCCCM', [
  // Indexada: server/graph.js filtra por este campo para no duplicar el
  // item al reintentar la sincronización de un mismo viaje.
  texto('ViajeId', {}, { indexed: true }),
  texto('Codigo', { maxLength: 20 }),
  texto('Estado', { maxLength: 20 }),
  texto('NombreReporta'),
  texto('FechaViaje', { maxLength: 20 }),
  texto('FechaReporte', { maxLength: 20 }),
  texto('JefeInmediato'),
  texto('Area'),
  texto('Origen'),
  texto('Destino'),
  texto('TransporteTipo', { maxLength: 40 }),
  texto('TransporteResumen', { allowMultipleLines: true }),
  texto('HoraInicio', { maxLength: 10 }),
  texto('ContactoNombre'),
  texto('CorreoVariable'),
  texto('ClosedAt', { maxLength: 40 }),
  texto('Observaciones', { allowMultipleLines: true }),
])

const idTrayectos = await crearListaSiNoExiste('TrayectosCCCM', [
  // Indexada por la misma razón que ViajeId arriba.
  texto('TrayectoId', {}, { indexed: true }),
  texto('Codigo', { maxLength: 20 }),
  texto('ViajeId'),
  numero('Numero'),
  texto('Estado', { maxLength: 20 }),
  texto('FechaReporte', { maxLength: 20 }),
  texto('JefeInmediato'),
  texto('Area'),
  texto('Origen'),
  texto('Destino'),
  texto('Transporte'),
  texto('HoraSalida', { maxLength: 10 }),
  texto('HoraLlegadaEstimada', { maxLength: 10 }),
  texto('ContactoEmergencia'),
  texto('ClosedAt', { maxLength: 40 }),
  texto('Observaciones', { allowMultipleLines: true }),
])

console.log('\nCopia estas líneas en tu .env:')
console.log(`SHAREPOINT_LIST_VIAJES_ID=${idViajes}`)
console.log(`SHAREPOINT_LIST_TRAYECTOS_ID=${idTrayectos}`)
