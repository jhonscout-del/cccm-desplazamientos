import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, msalReady, API_SCOPES } from './msal'

const API_URL = import.meta.env.VITE_API_URL || '/api'

async function getToken() {
  await msalReady
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
  if (!account) return null

  try {
    const result = await msalInstance.acquireTokenSilent({ scopes: API_SCOPES, account })
    return result.accessToken
  } catch (err) {
    // Solo forzar un login interactivo si Microsoft realmente lo exige
    // (p.ej. la sesión expiró). Si el error es simplemente estar sin señal,
    // se debe dejar que la app siga funcionando offline.
    if (err instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect({ scopes: API_SCOPES, account })
    }
    throw err
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

export const api = {
  me: () => request('/auth/me'),

  crearViaje: (viaje) => request('/viajes', { method: 'POST', body: viaje }),
  listarViajes: (estado) => request(`/viajes${estado ? `?estado=${estado}` : ''}`),
  obtenerViaje: (id) => request(`/viajes/${id}`),
  cerrarViaje: (id) => request(`/viajes/${id}/cerrar`, { method: 'PATCH' }),
  agregarObservacionViaje: (viajeId, obs) =>
    request(`/viajes/${viajeId}/observaciones`, { method: 'POST', body: obs }),

  crearTrayecto: (viajeId, trayecto) =>
    request(`/viajes/${viajeId}/trayectos`, { method: 'POST', body: trayecto }),
  cerrarTrayecto: (viajeId, trayectoId) =>
    request(`/viajes/${viajeId}/trayectos/${trayectoId}/cerrar`, { method: 'PATCH' }),
  agregarObservacionTrayecto: (viajeId, trayectoId, obs) =>
    request(`/viajes/${viajeId}/trayectos/${trayectoId}/observaciones`, { method: 'POST', body: obs }),
}
