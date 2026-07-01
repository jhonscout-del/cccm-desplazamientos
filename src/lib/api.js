const API_URL = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  try {
    return JSON.parse(localStorage.getItem('cccm_auth'))?.token ?? null
  } catch {
    return null
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
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
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/auth/me'),

  crearViaje: (viaje) => request('/viajes', { method: 'POST', body: viaje }),
  listarViajes: (estado) => request(`/viajes${estado ? `?estado=${estado}` : ''}`),
  obtenerViaje: (id) => request(`/viajes/${id}`),
  cerrarViaje: (id) => request(`/viajes/${id}/cerrar`, { method: 'PATCH' }),
  crearTrayecto: (viajeId, trayecto) =>
    request(`/viajes/${viajeId}/trayectos`, { method: 'POST', body: trayecto }),
}
