import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { EstadoBadge } from '../components/EstadoBadge'
import { transporteResumen } from '../lib/transporte'

export function Dashboard() {
  const [viajes, setViajes] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [error, setError] = useState('')

  const cargar = async () => {
    setError('')
    try {
      const data = await api.listarViajes(filtro || undefined)
      setViajes(data.viajes)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  const onCerrar = async (id) => {
    if (!confirm('¿Forzar el cierre de este viaje desde control?')) return
    try {
      await api.cerrarViaje(id)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Panel de control</h1>
        <button type="button" onClick={cargar} className="text-sm text-[var(--accent)]">
          Actualizar
        </button>
      </div>

      <div className="flex gap-2 text-sm">
        {[
          { value: '', label: 'Todos' },
          { value: 'abierto', label: 'En curso' },
          { value: 'cerrado', label: 'Cerrados' },
        ].map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltro(f.value)}
            className={`rounded-full border px-3 py-1 ${
              filtro === f.value ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">Necesitas conexión para ver el panel: {error}</p>}
      {viajes?.length === 0 && <p className="text-sm text-[var(--text)]">No hay viajes para este filtro.</p>}

      <ul className="flex flex-col gap-2">
        {viajes?.map((v) => (
          <li key={v.id} className="rounded border border-[var(--border)] p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {v.origen} → {v.destino} — {v.nombre_reporta}
              </span>
              <EstadoBadge estado={v.estado} />
            </div>
            <div className="text-[var(--text)]">
              {v.fecha_viaje} · {v.area} · Jefe: {v.jefe_inmediato}
            </div>
            <div className="text-[var(--text)]">
              {transporteResumen(v.transporte_tipo, JSON.parse(v.transporte_detalle || '{}'))} · Inicio: {v.hora_inicio}
            </div>
            <div className="text-[var(--text)]">Contacto emergencia: {v.contacto_nombre}</div>
            {v.estado === 'abierto' && (
              <button
                type="button"
                onClick={() => onCerrar(v.id)}
                className="mt-2 rounded border border-red-600 px-2 py-1 text-xs text-red-600"
              >
                Forzar cierre
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
