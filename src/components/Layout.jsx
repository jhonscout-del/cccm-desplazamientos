import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function Layout({ children }) {
  const { user, logout } = useAuth()
  const online = useOnlineStatus()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <Link to="/" className="font-semibold text-[var(--text-h)]">
          CCCM · Check-in de viajeros
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span
            className={`flex items-center gap-1 ${online ? 'text-green-600' : 'text-amber-600'}`}
            title={online ? 'Conectado' : 'Sin conexión: los registros se guardan y se enviarán después'}
          >
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
            {online ? 'En línea' : 'Sin conexión'}
          </span>
          {user && (
            <>
              <span className="hidden text-[var(--text)] sm:inline">{user.nombre}</span>
              <button
                type="button"
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                className="flex items-center gap-1 text-[var(--text)] hover:text-[var(--text-h)]"
              >
                <LogOut size={16} /> Salir
              </button>
            </>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
