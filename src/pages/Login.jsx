import { useAuth } from '../context/AuthContext'

export function Login() {
  const { login } = useAuth()

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 text-center">
      <h1 className="text-xl font-semibold">CCCM · Check-in de viajeros</h1>
      <p className="text-sm text-[var(--text)]">
        Inicia sesión con tu cuenta corporativa de Microsoft/Office para registrar y hacer
        seguimiento de tus desplazamientos.
      </p>
      <button
        type="button"
        onClick={login}
        className="rounded bg-[var(--accent)] px-3 py-2 font-medium text-white"
      >
        Iniciar sesión con Microsoft
      </button>
      <p className="text-xs text-[var(--text)]">
        Necesitas conexión la primera vez que inicias sesión en un dispositivo. Después, la app
        funciona sin señal.
      </p>
    </div>
  )
}
