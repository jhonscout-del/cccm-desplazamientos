// Ejecutar UNA VEZ, después de configurar AZURE_TENANT_ID, AZURE_GRAPH_CLIENT_ID,
// AZURE_GRAPH_CLIENT_SECRET y SHAREPOINT_SITE_ID en .env, para crear las dos
// listas de SharePoint con sus columnas. Al final imprime los IDs que debes
// copiar en SHAREPOINT_LIST_VIAJES_ID y SHAREPOINT_LIST_TRAYECTOS_ID.
//
// Uso: node server/scripts/provisionSharePoint.js

import 'dotenv/config'
import { graphFetchDirect } from '../graph.js'

const SITE_ID = process.env.SHAREPOINT_SITE_ID
if (!SITE_ID) throw new Error('Falta SHAREPOINT_SITE_ID en .env')

const texto = (name, opts = {}) => ({ name, text: { allowMultipleLines: false, maxLength: 255, ...opts } })
const numero = (name) => ({ name, number: {} })

async function crearListaSiNoExiste(displayName, columns) {
  const existentes = await graphFetchDirect(`/sites/${SITE_ID}/lists?$filter=displayName eq '${displayName}'`)
  if (existentes.value?.length) {
    console.log(`Ya existe "${displayName}" -> id: ${existentes.value[0].id}`)
    return existentes.value[0].id
  }

  const creada = await graphFetchDirect(`/sites/${SITE_ID}/lists`, {
    method: 'POST',
    body: JSON.stringify({ displayName, list: { template: 'genericList' }, columns }),
  })
  console.log(`Creada "${displayName}" -> id: ${creada.id}`)
  return creada.id
}

const idViajes = await crearListaSiNoExiste('ViajesCCCM', [
  texto('ViajeId'),
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
])

const idTrayectos = await crearListaSiNoExiste('TrayectosCCCM', [
  texto('TrayectoId'),
  texto('ViajeId'),
  numero('Numero'),
  texto('FechaReporte', { maxLength: 20 }),
  texto('JefeInmediato'),
  texto('Area'),
  texto('Origen'),
  texto('Destino'),
  texto('Transporte'),
  texto('HoraSalida', { maxLength: 10 }),
  texto('HoraLlegadaEstimada', { maxLength: 10 }),
  texto('ContactoEmergencia'),
])

console.log('\nCopia estas líneas en tu .env:')
console.log(`SHAREPOINT_LIST_VIAJES_ID=${idViajes}`)
console.log(`SHAREPOINT_LIST_TRAYECTOS_ID=${idTrayectos}`)
