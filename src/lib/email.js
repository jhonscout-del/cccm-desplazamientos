import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, msalReady, MAIL_SCOPES } from './msal'
import { transporteResumen } from './transporte'

// Correo de seguimiento fijo: siempre recibe copia de todos los reportes.
export const CORREO_FIJO = 'gerente.seguridad@colombiasinminas.org'

async function graphMailToken() {
  await msalReady
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
  if (!account) throw new Error('No hay sesión activa para enviar el correo')

  try {
    const result = await msalInstance.acquireTokenSilent({ scopes: MAIL_SCOPES, account })
    return result.accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect({ scopes: MAIL_SCOPES, account })
    }
    throw err
  }
}

// Envía el correo desde el buzón del usuario que inició sesión, vía
// Microsoft Graph (POST /me/sendMail), a los dos destinatarios.
async function enviarCorreo({ asunto, cuerpo, correoVariable }) {
  const token = await graphMailToken()
  const destinatarios = [CORREO_FIJO, correoVariable]
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }))

  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: asunto,
        body: { contentType: 'Text', content: cuerpo },
        toRecipients: destinatarios,
      },
      saveToSentItems: true,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Graph sendMail -> ${res.status}: ${body}`)
  }
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
