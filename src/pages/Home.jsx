import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { localDb } from '../lib/localdb'
import { EstadoBadge } from '../components/EstadoBadge'

export function Home() {
  const { user } = useAuth()
  const viajes = useLiveQuery(
    () => localDb.viajes.where('userId').equals(user.id).reverse().sortBy('createdAt'),
    [user.id],
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mis viajes</h1>
        <Link
          to="/viajes/nuevo"
          className="flex items-center gap-1 rounded bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} /> Nuevo viaje
        </Link>
      </div>

      {viajes?.length === 0 && (
        <p className="text-sm text-[var(--text)]">
          Aún no tienes viajes registrados. Inicia uno con "Nuevo viaje" antes de salir.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {viajes?.map((v) => (
          <li key={v.id}>
            <Link
              to={`/viajes/${v.id}`}
              className="flex flex-col gap-1 rounded border border-[var(--border)] p-3 hover:border-[var(--accent)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {v.codigo && <span className="text-[var(--accent)]">{v.codigo}</span>} {v.origen} → {v.destino}
                </span>
                <EstadoBadge estado={v.estado} />
              </div>
              <span className="text-sm text-[var(--text)]">
                {v.fechaViaje} · {v.area}
                {v.syncStatus === 'pending' && ' · pendiente de sincronizar'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
