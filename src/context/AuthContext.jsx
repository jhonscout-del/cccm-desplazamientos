import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { MsalProvider, useMsal } from '@azure/msal-react'
import { msalInstance, API_SCOPES } from '../lib/msal'
import { api } from '../lib/api'

const AuthContext = createContext(null)
const STORAGE_KEY = 'cccm_user'

function loadCachedUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function InnerAuthProvider({ children }) {
  const { instance, accounts } = useMsal()
  const account = accounts[0] ?? null
  const [user, setUser] = useState(loadCachedUser)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (account) instance.setActiveAccount(account)
  }, [account, instance])

  useEffect(() => {
    let cancelled = false

    async function syncPerfil() {
      if (!account) {
        localStorage.removeItem(STORAGE_KEY)
        setUser(null)
        setReady(true)
        return
      }
      try {
        // Da de alta (o refresca) al usuario local a partir de su cuenta
        // Microsoft ya autenticada. Requiere conexión la primera vez.
        const { user: perfil } = await api.me()
        if (!cancelled) {
          setUser(perfil)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(perfil))
        }
      } catch {
        // Sin conexión: seguimos con el perfil cacheado de un login anterior.
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    syncPerfil()
    return () => {
      cancelled = true
    }
  }, [account])

  const login = () => instance.loginRedirect({ scopes: API_SCOPES })

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    instance.logoutRedirect()
  }

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(account && user), ready, login, logout }),
    [user, account, ready, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }) {
  return (
    <MsalProvider instance={msalInstance}>
      <InnerAuthProvider>{children}</InnerAuthProvider>
    </MsalProvider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
