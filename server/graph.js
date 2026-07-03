import { ConfidentialClientApplication } from '@azure/msal-node'

const TENANT_ID = process.env.AZURE_TENANT_ID
const CLIENT_ID = process.env.AZURE_GRAPH_CLIENT_ID
const CLIENT_SECRET = process.env.AZURE_GRAPH_CLIENT_SECRET
const SITE_ID = process.env.SHAREPOINT_SITE_ID
const LIST_VIAJES_ID = process.env.SHAREPOINT_LIST_VIAJES_ID
const LIST_TRAYECTOS_ID = process.env.SHAREPOINT_LIST_TRAYECTOS_ID

// Credenciales mínimas para hablar con Graph (usadas también por el script
// de aprovisionamiento, que corre antes de que existan los IDs de lista).
const GRAPH_CREDS_OK = Boolean(TENANT_ID && CLIENT_ID && CLIENT_SECRET && SITE_ID)
// Listo para reflejar viajes/trayectos en tiempo real (ya con las listas creadas).
const GRAPH_ENABLED = GRAPH_CREDS_OK && Boolean(LIST_VIAJES_ID)

const msalApp = GRAPH_CREDS_OK
  ? new ConfidentialClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        clientSecret: CLIENT_SECRET,
      },
    })
  : null

async function graphToken() {
  const result = await msalApp.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  })
  return result.accessToken
}

// Llamada genérica a Graph con reintento de token; nunca lanza más que el
// error original, lo maneja quien la invoque (uso "best effort", no crítico).
async function graphFetch(path, options = {}) {
  const token = await graphToken()
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Graph ${options.method || 'GET'} ${path} -> ${res.status}: ${body}`)
  }
  return res.status === 204 ? null : res.json()
}

// Igual que graphFetch, pero exportada para el script de aprovisionamiento
// (que solo necesita TENANT/CLIENT/SECRET/SITE, aún sin IDs de lista).
export function graphFetchDirect(path, options = {}) {
  if (!GRAPH_CREDS_OK) {
    throw new Error('Faltan credenciales de Graph (AZURE_TENANT_ID, AZURE_GRAPH_CLIENT_ID, AZURE_GRAPH_CLIENT_SECRET, SHAREPOINT_SITE_ID)')
  }
  return graphFetch(path, options)
}

export function graphEnabled() {
  return GRAPH_ENABLED
}

function transporteResumenPlano(tipo, detalleJson) {
  try {
    const detalle = JSON.parse(detalleJson || '{}')
    const partes = Object.entries(detalle)
      .filter(([, v]) => v && v !== false)
      .map(([k, v]) => `${k}: ${v}`)
    return `${tipo} — ${partes.join(', ')}`
  } catch {
    return tipo || ''
  }
}

// Crea el item si no existe (buscado por su columna indexada), o lo
// actualiza si ya se había sincronizado antes (p.ej. al cerrarlo o agregar
// una observación) — mismo patrón para viajes y trayectos.
async function upsertItem(listId, filterField, filterValue, fields) {
  const existentes = await graphFetch(
    `/sites/${SITE_ID}/lists/${listId}/items?$filter=fields/${filterField} eq '${filterValue}'&$expand=fields`,
  )

  if (existentes.value?.length) {
    await graphFetch(`/sites/${SITE_ID}/lists/${listId}/items/${existentes.value[0].id}/fields`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    })
  } else {
    await graphFetch(`/sites/${SITE_ID}/lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    })
  }
}

// Refleja el viaje en la lista de SharePoint (crea el item si no existe, o
// lo actualiza si ya se había sincronizado antes, p.ej. al cerrarlo o
// agregarle una observación).
export async function upsertViajeEnSharePoint(viaje, observacionesTexto = '') {
  if (!GRAPH_ENABLED) return

  const fields = {
    Title: `${viaje.codigo}: ${viaje.origen} -> ${viaje.destino}`,
    ViajeId: viaje.id,
    Codigo: viaje.codigo,
    Estado: viaje.estado,
    NombreReporta: viaje.nombre_reporta,
    FechaViaje: viaje.fecha_viaje,
    FechaReporte: viaje.fecha_reporte,
    JefeInmediato: viaje.jefe_inmediato,
    Area: viaje.area,
    Origen: viaje.origen,
    Destino: viaje.destino,
    TransporteTipo: viaje.transporte_tipo,
    TransporteResumen: transporteResumenPlano(viaje.transporte_tipo, viaje.transporte_detalle),
    HoraInicio: viaje.hora_inicio,
    ContactoNombre: viaje.contacto_nombre,
    CorreoVariable: viaje.correo_variable,
    ClosedAt: viaje.closed_at || '',
    Observaciones: observacionesTexto,
  }

  await upsertItem(LIST_VIAJES_ID, 'ViajeId', viaje.id, fields)
}

// Igual que arriba, pero para un trayecto interno — el código y el filtro
// de SharePoint quedan ligados al viaje al que pertenece.
export async function upsertTrayectoEnSharePoint(trayecto, observacionesTexto = '') {
  if (!GRAPH_ENABLED || !LIST_TRAYECTOS_ID) return

  const fields = {
    Title: `${trayecto.codigo}: ${trayecto.origen} -> ${trayecto.destino}`,
    TrayectoId: trayecto.id,
    Codigo: trayecto.codigo,
    ViajeId: trayecto.viaje_id,
    Numero: trayecto.numero,
    Estado: trayecto.estado,
    FechaReporte: trayecto.fecha_reporte,
    JefeInmediato: trayecto.jefe_inmediato,
    Area: trayecto.area,
    Origen: trayecto.origen,
    Destino: trayecto.destino,
    Transporte: trayecto.transporte,
    HoraSalida: trayecto.hora_salida,
    HoraLlegadaEstimada: trayecto.hora_llegada_estimada,
    ContactoEmergencia: trayecto.contacto_emergencia,
    ClosedAt: trayecto.closed_at || '',
    Observaciones: observacionesTexto,
  }

  await upsertItem(LIST_TRAYECTOS_ID, 'TrayectoId', trayecto.id, fields)
}
