import { createContext, useContext, useMemo, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)
const STORAGE_KEY = 'cccm_auth'

function loadStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

// Persiste de forma síncrona (antes de actualizar el estado de React) para
// que cualquier efecto que dispare una llamada a la API al iniciar sesión
// siempre encuentre el token ya guardado en localStorage.
function persist(value) {
  if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  else localStorage.removeItem(STORAGE_KEY)
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadStoredAuth)

  const login = async (email, password) => {
    const { user, token } = await api.login({ email, password })
    persist({ user, token })
    setAuth({ user, token })
  }

  const register = async (nombre, email, password) => {
    const { user, token } = await api.register({ nombre, email, password })
    persist({ user, token })
    setAuth({ user, token })
  }

  const logout = () => {
    persist(null)
    setAuth(null)
  }

  const value = useMemo(
    () => ({ user: auth?.user ?? null, isAuthenticated: Boolean(auth), login, register, logout }),
    [auth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
