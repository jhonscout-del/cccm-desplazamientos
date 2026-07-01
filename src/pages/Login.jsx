import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      <p className="text-sm text-[var(--text)]">
        Necesitas conexión la primera vez que inicias sesión en un dispositivo. Después, la app
        funciona sin señal.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Correo</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-[var(--border)] bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-[var(--border)] bg-transparent px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-[var(--accent)] px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="text-sm">
        ¿No tienes cuenta? <Link to="/registro" className="text-[var(--accent)]">Regístrate</Link>
      </p>
    </div>
  )
}
