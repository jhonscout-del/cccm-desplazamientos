import emailjs from '@emailjs/browser'
import { transporteResumen } from './transporte'

// Correo de seguimiento fijo: siempre recibe copia de todos los reportes.
export const CORREO_FIJO = 'gerente.seguridad@colombiasinminas.org'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

function emailjsConfigured() {
  return Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)
}

async function enviarCorreo({ asunto, cuerpo, correoVariable }) {
  if (!emailjsConfigured()) {
    throw new Error('EmailJS no está configurado (faltan variables VITE_EMAILJS_*)')
  }
  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_fijo: CORREO_FIJO,
      to_variable: correoVariable || '',
      subject: asunto,
      message: cuerpo,
    },
    { publicKey: PUBLIC_KEY },
  )
}

export function enviarCorreoCheckin(viaje) {
  const asunto = `Check-in CCCM: ${viaje.nombreReporta} — ${viaje.origen} a ${viaje.destino}`
  const cuerpo = [
    `Nombre de quien reporta: ${viaje.nombreReporta}`,
    `Fecha del viaje: ${viaje.fechaViaje}`,
    `Fecha del reporte: ${viaje.fechaReporte}`,
    `Jefe inmediato: ${viaje.jefeInmediato}`,
    `Área: ${viaje.area}`,
    `Origen - Destino: ${viaje.origen} - ${viaje.destino}`,
    `Transporte: ${transporteResumen(viaje.transporteTipo, viaje.transporteDetalle)}`,
    `Hora estimada de inicio: ${viaje.horaInicio}`,
    `Contacto en caso de emergencia: ${viaje.contactoNombre}`,
    '',
    'Estado: VIAJE INICIADO',
  ].join('\n')
  return enviarCorreo({ asunto, cuerpo, correoVariable: viaje.correoVariable })
}

export function enviarCorreoTrayecto(viaje, trayecto) {
  const asunto = `Trayecto ${trayecto.numero} CCCM: ${viaje.nombreReporta} — ${trayecto.origen} a ${trayecto.destino}`
  const cuerpo = [
    `Viaje principal: ${viaje.origen} - ${viaje.destino} (${viaje.nombreReporta})`,
    `Trayecto ${trayecto.numero}`,
    `Fecha del reporte: ${trayecto.fechaReporte}`,
    `Jefe inmediato: ${trayecto.jefeInmediato}`,
    `Área: ${trayecto.area}`,
    `Origen - Destino: ${trayecto.origen} - ${trayecto.destino}`,
    `Transporte: ${trayecto.transporte}`,
    `Hora salida: ${trayecto.horaSalida}`,
    `Hora estimada de llegada: ${trayecto.horaLlegadaEstimada}`,
    `Contacto de emergencia: ${trayecto.contactoEmergencia}`,
  ].join('\n')
  return enviarCorreo({ asunto, cuerpo, correoVariable: viaje.correoVariable })
}

export function enviarCorreoCierre(viaje) {
  const asunto = `Cierre de viaje CCCM: ${viaje.nombreReporta} — ${viaje.origen} a ${viaje.destino}`
  const cuerpo = [
    `Nombre de quien reporta: ${viaje.nombreReporta}`,
    `Origen - Destino: ${viaje.origen} - ${viaje.destino}`,
    `Hora de cierre: ${new Date(viaje.closedAt || Date.now()).toLocaleString()}`,
    '',
    'Estado: VIAJE FINALIZADO SIN NOVEDAD',
  ].join('\n')
  return enviarCorreo({ asunto, cuerpo, correoVariable: viaje.correoVariable })
}
