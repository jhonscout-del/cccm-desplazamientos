import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { crearViajeLocal } from '../lib/sync'
import { TransporteFields } from '../components/TransporteFields'

const hoy = () => new Date().toISOString().slice(0, 10)

export function NuevoViaje() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombreReporta: user.nombre,
    fechaViaje: hoy(),
    fechaReporte: hoy(),
    jefeInmediato: '',
    area: '',
    origen: '',
    destino: '',
    horaInicio: '',
    contactoNombre: '',
    correoVariable: '',
  })
  const [transporteTipo, setTransporteTipo] = useState('')
  const [transporteDetalle, setTransporteDetalle] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!transporteTipo) return
    setSaving(true)
    const viaje = await crearViajeLocal(user, { ...form, transporteTipo, transporteDetalle })
    navigate(`/viajes/${viaje.id}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Check-in de viaje</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Campo label="Nombre de quien reporta">
          <input required value={form.nombreReporta} onChange={set('nombreReporta')} className="input" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha del viaje">
            <input type="date" required value={form.fechaViaje} onChange={set('fechaViaje')} className="input" />
          </Campo>
          <Campo label="Fecha del reporte">
            <input type="date" required value={form.fechaReporte} onChange={set('fechaReporte')} className="input" />
          </Campo>
        </div>
        <Campo label="Nombre del jefe inmediato">
          <input required value={form.jefeInmediato} onChange={set('jefeInmediato')} className="input" />
        </Campo>
        <Campo label="Área a la que pertenece">
          <input required value={form.area} onChange={set('area')} className="input" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Origen">
            <input required value={form.origen} onChange={set('origen')} className="input" />
          </Campo>
          <Campo label="Destino">
            <input required value={form.destino} onChange={set('destino')} className="input" />
          </Campo>
        </div>

        <TransporteFields
          tipo={transporteTipo}
          detalle={transporteDetalle}
          onTipoChange={setTransporteTipo}
          onDetalleChange={(name, value) => setTransporteDetalle((d) => ({ ...d, [name]: value }))}
        />

        <Campo label="Hora tentativa de inicio del desplazamiento">
          <input type="time" required value={form.horaInicio} onChange={set('horaInicio')} className="input" />
        </Campo>
        <Campo label="Nombre de persona a quien acudir (contacto de emergencia)">
          <input required value={form.contactoNombre} onChange={set('contactoNombre')} className="input" />
        </Campo>
        <Campo label="Correo del jefe inmediato / coordinador (recibirá el reporte)">
          <input type="email" required value={form.correoVariable} onChange={set('correoVariable')} className="input" />
        </Campo>

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-[var(--accent)] px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Iniciar viaje'}
        </button>
        <p className="text-xs text-[var(--text)]">
          Si no tienes señal, el registro se guarda en tu dispositivo y se enviará por correo
          automáticamente en cuanto haya conexión.
        </p>
      </form>
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
