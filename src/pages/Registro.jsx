import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Registro() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(nombre, email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-xl font-semibold">Crear cuenta</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Nombre completo</span>
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded border border-[var(--border)] bg-transparent px-3 py-2"
          />
        </label>
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
          <span className="text-sm font-medium">Contraseña (mínimo 6 caracteres)</span>
          <input
            type="password"
            required
            minLength={6}
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
          {loading ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="text-sm">
        ¿Ya tienes cuenta? <Link to="/login" className="text-[var(--accent)]">Inicia sesión</Link>
      </p>
    </div>
  )
}
