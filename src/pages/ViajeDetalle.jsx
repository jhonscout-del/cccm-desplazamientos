import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDb } from '../lib/localdb'
import { useAuth } from '../context/AuthContext'
import {
  agregarTrayectoLocal,
  cerrarViajeLocal,
  cerrarTrayectoLocal,
  agregarObservacionLocal,
  observacionesDe,
} from '../lib/sync'
import { transporteResumen } from '../lib/transporte'
import { EstadoBadge } from '../components/EstadoBadge'
import { Observaciones } from '../components/Observaciones'

const hoy = () => new Date().toISOString().slice(0, 10)

const TRAYECTO_VACIO = {
  fechaReporte: hoy(),
  jefeInmediato: '',
  area: '',
  origen: '',
  destino: '',
  transporte: '',
  horaSalida: '',
  horaLlegadaEstimada: '',
  contactoEmergencia: '',
}

export function ViajeDetalle() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const viaje = useLiveQuery(() => localDb.viajes.get(id), [id])
  const trayectos = useLiveQuery(
    () => localDb.trayectos.where('viajeId').equals(id).sortBy('numero'),
    [id],
    [],
  )
  const observacionesViaje = useLiveQuery(() => observacionesDe(id), [id], [])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nuevo, setNuevo] = useState(TRAYECTO_VACIO)
  const [cerrando, setCerrando] = useState(false)

  if (viaje === undefined) return <p>Cargando…</p>
  if (viaje === null) return <p>No se encontró este viaje en este dispositivo.</p>

  const puedeCerrar = viaje.estado === 'abierto' && (viaje.userId === user.id || user.role === 'control')

  const set = (name) => (e) => setNuevo((n) => ({ ...n, [name]: e.target.value }))

  const onAgregarTrayecto = async (e) => {
    e.preventDefault()
    await agregarTrayectoLocal(viaje, nuevo)
    setNuevo({ ...TRAYECTO_VACIO, fechaReporte: hoy() })
    setMostrarForm(false)
  }

  const onCerrar = async () => {
    if (!confirm('¿Confirmas que deseas cerrar este viaje?')) return
    setCerrando(true)
    await cerrarViajeLocal(viaje)
    setCerrando(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={() => navigate('/')} className="w-fit text-sm text-[var(--accent)]">
        ← Mis viajes
      </button>

      <div className="flex flex-col gap-3 rounded border border-[var(--border)] p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            {viaje.codigo && <span className="text-[var(--accent)]">{viaje.codigo}</span>}{' '}
            {viaje.origen} → {viaje.destino}
          </h1>
          <EstadoBadge estado={viaje.estado} />
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <Dato label="Reporta" valor={viaje.nombreReporta} />
          <Dato label="Fecha del viaje" valor={viaje.fechaViaje} />
          <Dato label="Jefe inmediato" valor={viaje.jefeInmediato} />
          <Dato label="Área" valor={viaje.area} />
          <Dato label="Transporte" valor={transporteResumen(viaje.transporteTipo, viaje.transporteDetalle)} full />
          <Dato label="Hora inicio" valor={viaje.horaInicio} />
          <Dato label="Contacto de emergencia" valor={viaje.contactoNombre} />
          {viaje.closedAt && <Dato label="Cerrado el" valor={new Date(viaje.closedAt).toLocaleString()} full />}
        </dl>

        <Observaciones
          observaciones={observacionesViaje}
          editable={viaje.estado === 'abierto'}
          onAgregar={(texto) => agregarObservacionLocal(viaje, texto)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">Trayectos internos</h2>
        {trayectos?.length === 0 && (
          <p className="text-sm text-[var(--text)]">Aún no hay trayectos internos registrados.</p>
        )}
        <ul className="flex flex-col gap-2">
          {trayectos?.map((t) => (
            <TrayectoCard key={t.id} viaje={viaje} trayecto={t} user={user} />
          ))}
        </ul>

        {viaje.estado === 'abierto' && !mostrarForm && (
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="w-fit rounded border border-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent)]"
          >
            + Agregar trayecto
          </button>
        )}

        {mostrarForm && (
          <form onSubmit={onAgregarTrayecto} className="flex flex-col gap-3 rounded border border-[var(--border)] p-3">
            <Campo label="Fecha del reporte">
              <input type="date" required value={nuevo.fechaReporte} onChange={set('fechaReporte')} className="input" />
            </Campo>
            <Campo label="Jefe inmediato">
              <input required value={nuevo.jefeInmediato} onChange={set('jefeInmediato')} className="input" />
            </Campo>
            <Campo label="Área">
              <input required value={nuevo.area} onChange={set('area')} className="input" />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Origen">
                <input required value={nuevo.origen} onChange={set('origen')} className="input" />
              </Campo>
              <Campo label="Destino">
                <input required value={nuevo.destino} onChange={set('destino')} className="input" />
              </Campo>
            </div>
            <Campo label="Transporte">
              <input required value={nuevo.transporte} onChange={set('transporte')} className="input" />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Hora salida">
                <input type="time" required value={nuevo.horaSalida} onChange={set('horaSalida')} className="input" />
              </Campo>
              <Campo label="Hora estimada llegada">
                <input type="time" required value={nuevo.horaLlegadaEstimada} onChange={set('horaLlegadaEstimada')} className="input" />
              </Campo>
            </div>
            <Campo label="Contacto de emergencia">
              <input required value={nuevo.contactoEmergencia} onChange={set('contactoEmergencia')} className="input" />
            </Campo>
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-[var(--accent)] px-3 py-2 font-medium text-white">
                Guardar trayecto
              </button>
              <button type="button" onClick={() => setMostrarForm(false)} className="rounded border border-[var(--border)] px-3 py-2">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {puedeCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          disabled={cerrando}
          className="rounded bg-green-700 px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {cerrando ? 'Cerrando…' : 'Cerrar viaje (check-out)'}
        </button>
      )}
      {viaje.estado === 'abierto' && !puedeCerrar && (
        <p className="text-sm text-[var(--text)]">
          Solo quien inició este viaje (o el equipo de control) puede cerrarlo.
        </p>
      )}
    </div>
  )
}

function TrayectoCard({ viaje, trayecto, user }) {
  const observaciones = useLiveQuery(
    () => observacionesDe(viaje.id, trayecto.id),
    [viaje.id, trayecto.id],
    [],
  )
  const [cerrando, setCerrando] = useState(false)
  const puedeCerrar = trayecto.estado === 'abierto' && (viaje.userId === user.id || user.role === 'control')

  const onCerrar = async () => {
    if (!confirm(`¿Confirmas que deseas cerrar el trayecto ${trayecto.codigo || trayecto.numero}?`)) return
    setCerrando(true)
    await cerrarTrayectoLocal(trayecto)
    setCerrando(false)
  }

  return (
    <li className="flex flex-col gap-2 rounded border border-[var(--border)] p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">
          {trayecto.codigo || `Trayecto ${trayecto.numero}`}: {trayecto.origen} → {trayecto.destino}
        </div>
        <EstadoBadge estado={trayecto.estado} />
      </div>
      <div className="text-[var(--text)]">
        {trayecto.fechaReporte} · Salida {trayecto.horaSalida} · Llegada estimada {trayecto.horaLlegadaEstimada}
      </div>
      <div className="text-[var(--text)]">
        {trayecto.transporte} · Emergencia: {trayecto.contactoEmergencia}
      </div>
      {trayecto.closedAt && (
        <div className="text-[var(--text)]">Cerrado el {new Date(trayecto.closedAt).toLocaleString()}</div>
      )}

      <Observaciones
        observaciones={observaciones}
        editable={trayecto.estado === 'abierto'}
        onAgregar={(texto) => agregarObservacionLocal(viaje, texto, trayecto)}
      />

      {puedeCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          disabled={cerrando}
          className="w-fit rounded border border-red-600 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
        >
          {cerrando ? 'Cerrando…' : 'Cerrar trayecto'}
        </button>
      )}
    </li>
  )
}

function Dato({ label, valor, full }) {
  return (
    <div className={full ? 'col-span-2' : undefined}>
      <dt className="text-[var(--text)]">{label}</dt>
      <dd className="font-medium">{valor || '—'}</dd>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}
