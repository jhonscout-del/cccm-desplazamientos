import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { syncNow, pullMisViajes } from '../lib/sync'

const INTERVALO_MS = 30000

// Componente invisible: mientras haya sesión, intenta sincronizar lo
// pendiente (creaciones, trayectos, cierres, correos) al iniciar, al volver
// la conexión, y en un intervalo de respaldo.
export function SyncEngine() {
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) return

    const tick = () => {
      syncNow()
      pullMisViajes()
    }

    tick()
    const interval = setInterval(tick, INTERVALO_MS)
    window.addEventListener('online', tick)
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', tick)
    }
  }, [isAuthenticated])

  return null
}
