import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const CONFIGURADO = Boolean(import.meta.env.VITE_AZURE_CLIENT_ID && import.meta.env.VITE_AZURE_TENANT_ID)

export function Login() {
  const { login } = useAuth()
  const [error, setError] = useState('')

  const onClick = async () => {
    setError('')
    try {
      await login()
    } catch (err) {
      setError(err.message || 'No se pudo iniciar el login con Microsoft.')
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 text-center">
      <h1 className="text-xl font-semibold">CCCM · Check-in de viajeros</h1>
      <p className="text-sm text-[var(--text)]">
        Inicia sesión con tu cuenta corporativa de Microsoft/Office para registrar y hacer
        seguimiento de tus desplazamientos.
      </p>

      {!CONFIGURADO ? (
        <p className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
          Esta instalación todavía no tiene configurado el login con Microsoft
          (faltan las variables <code>VITE_AZURE_CLIENT_ID</code> /{' '}
          <code>VITE_AZURE_TENANT_ID</code> al compilar la app). Revisa el README.
        </p>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="rounded bg-[var(--accent)] px-3 py-2 font-medium text-white"
        >
          Iniciar sesión con Microsoft
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-xs text-[var(--text)]">
        Necesitas conexión la primera vez que inicias sesión en un dispositivo. Después, la app
        funciona sin señal.
      </p>
    </div>
  )
}
