// Configuración de las opciones de transporte del formulario de check-in,
// según la plantilla CCCM. Cada tipo define sus propios campos, y algunos
// (carro, moto, fluvial) tienen un bloque adicional cuando el transporte es de CCCM.

export const TRANSPORTE_TIPOS = [
  { value: 'aereo', label: 'Aéreo' },
  { value: 'terrestre_carro', label: 'Terrestre - Carro' },
  { value: 'terrestre_moto', label: 'Terrestre - Moto' },
  { value: 'terrestre_mular', label: 'Terrestre - Mular' },
  { value: 'terrestre_pie', label: 'Terrestre - A pie' },
  { value: 'maritimo_fluvial', label: 'Marítimo / Fluvial' },
]

export const TRANSPORTE_CAMPOS = {
  aereo: [
    { name: 'aerolinea', label: 'Aerolínea', required: true },
    { name: 'numero_vuelo', label: 'Número de vuelo', required: true },
  ],
  terrestre_carro: [
    { name: 'cooperativa', label: 'Cooperativa de transporte' },
    { name: 'tipo_vehiculo', label: 'Tipo de vehículo', required: true },
    { name: 'color', label: 'Color', required: true },
    { name: 'placa', label: 'Placa', required: true },
    { name: 'es_cccm', label: '¿Es transporte de CCCM?', type: 'checkbox' },
    { name: 'numero_vehiculo_cccm', label: 'Número de vehículo (CCCM)', onlyIf: 'es_cccm' },
    { name: 'conductor_cccm', label: 'Nombre del conductor (CCCM)', onlyIf: 'es_cccm' },
  ],
  terrestre_moto: [
    { name: 'tipo_moto', label: 'Tipo de moto', required: true },
    { name: 'color', label: 'Color', required: true },
    { name: 'placa', label: 'Placa', required: true },
    { name: 'cooperativa', label: 'Nombre de la cooperativa (si aplica)' },
    { name: 'es_cccm', label: '¿Es transporte de CCCM?', type: 'checkbox' },
    { name: 'numero_cccm', label: 'Número (CCCM)', onlyIf: 'es_cccm' },
  ],
  terrestre_mular: [
    { name: 'arriero', label: 'Nombre del arriero o propietario de las mulas', required: true },
  ],
  terrestre_pie: [
    { name: 'guia', label: 'Nombre del guía o personas locales que acompañarán', required: true },
  ],
  maritimo_fluvial: [
    { name: 'equipo_rio', label: 'Nombre o número del equipo de río', required: true },
    { name: 'caracteristica', label: 'Característica de referencia' },
    { name: 'es_cccm', label: '¿Es transporte de CCCM?', type: 'checkbox' },
    { name: 'numero_cccm', label: 'Número (CCCM)', onlyIf: 'es_cccm' },
    { name: 'motorista_cccm', label: 'Nombre del motorista (CCCM)', onlyIf: 'es_cccm' },
  ],
}

export function transporteResumen(tipo, detalle = {}) {
  const label = TRANSPORTE_TIPOS.find((t) => t.value === tipo)?.label || tipo
  const campos = TRANSPORTE_CAMPOS[tipo] || []
  const partes = campos
    .filter((c) => c.type !== 'checkbox' && detalle[c.name])
    .map((c) => `${c.label}: ${detalle[c.name]}`)
  return `${label}${partes.length ? ' — ' + partes.join(', ') : ''}`
}
