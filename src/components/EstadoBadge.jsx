export function EstadoBadge({ estado }) {
  const abierto = estado === 'abierto'
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        abierto ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
      }`}
    >
      {abierto ? 'En curso' : 'Cerrado'}
    </span>
  )
}
