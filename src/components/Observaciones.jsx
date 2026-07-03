import { useState } from 'react'

export function Observaciones({ observaciones, onAgregar, editable }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!texto.trim()) return
    setEnviando(true)
    await onAgregar(texto.trim())
    setTexto('')
    setEnviando(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Observaciones</h3>
      {observaciones?.length === 0 && (
        <p className="text-xs text-[var(--text)]">Sin observaciones todavía.</p>
      )}
      <ul className="flex flex-col gap-1">
        {observaciones?.map((o) => (
          <li key={o.id} className="rounded border border-[var(--border)] p-2 text-xs">
            <div className="text-[var(--text)]">
              {new Date(o.createdAt).toLocaleString()}
              {o.autor ? ` · ${o.autor}` : ''}
            </div>
            <div>{o.texto}</div>
          </li>
        ))}
      </ul>
      {editable && (
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Agregar observación…"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="rounded border border-[var(--accent)] px-2 py-1 text-xs text-[var(--accent)] disabled:opacity-50"
          >
            Agregar
          </button>
        </form>
      )}
    </div>
  )
}
