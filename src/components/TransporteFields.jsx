import { TRANSPORTE_TIPOS, TRANSPORTE_CAMPOS } from '../lib/transporte'

export function TransporteFields({ tipo, detalle, onTipoChange, onDetalleChange }) {
  const campos = TRANSPORTE_CAMPOS[tipo] || []

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Opciones de transporte</span>
        <select
          required
          value={tipo}
          onChange={(e) => onTipoChange(e.target.value)}
          className="rounded border border-[var(--border)] bg-transparent px-3 py-2"
        >
          <option value="" disabled>
            Selecciona el tipo de transporte
          </option>
          {TRANSPORTE_TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {campos.map((campo) => {
        if (campo.onlyIf && !detalle[campo.onlyIf]) return null

        if (campo.type === 'checkbox') {
          return (
            <label key={campo.name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(detalle[campo.name])}
                onChange={(e) => onDetalleChange(campo.name, e.target.checked)}
              />
              {campo.label}
            </label>
          )
        }

        return (
          <label key={campo.name} className="flex flex-col gap-1">
            <span className="text-sm font-medium">{campo.label}</span>
            <input
              type="text"
              required={campo.required}
              value={detalle[campo.name] || ''}
              onChange={(e) => onDetalleChange(campo.name, e.target.value)}
              className="rounded border border-[var(--border)] bg-transparent px-3 py-2"
            />
          </label>
        )
      })}
    </div>
  )
}
