import { getStoredFbParams } from './fbclid'

// Endpoints de GHL de la subcuenta de Arlog.
// Todos los webhooks de la subcuenta actualizan el mismo contacto (se cruza por correo/teléfono).
// Si alguno queda vacío, ese envío se omite (nunca mandar leads a la cuenta de otro cliente).
export const GHL_CONTACT_WEBHOOK =
  'https://services.leadconnectorhq.com/hooks/TvW9G67TrCg2VD5ZORoO/webhook-trigger/8ceuPBZ9n7qaCCdktUzS'
export const GHL_QUALIFICATION_WEBHOOK =
  'https://services.leadconnectorhq.com/hooks/TvW9G67TrCg2VD5ZORoO/webhook-trigger/0vj9IygAueoO1K23C9Id'
export const GHL_BOOKING_CALENDAR = 'https://api.leadconnectorhq.com/widget/booking/juIoDHRJl4kJXiC7oWyB'

export function generateEventId(prefix = 'evt'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// En localhost no se envía nada al CRM de Arlog (solo se muestra en consola),
// salvo que se abra con ?ghl=1 para probar los workflows a propósito.
const LOCAL_STUB =
  /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) &&
  !new URLSearchParams(window.location.search).has('ghl')

export async function postToGhl(url: string, body: Record<string, unknown>) {
  if (!url) return
  if (LOCAL_STUB) {
    console.info('[GHL stub]', url.split('/').pop(), body)
    return
  }
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Nota legible para el CRM: datos del contacto, detalle de la etapa y atribución de Meta.
 * Se manda como `nota` y `notas` para que el workflow de GHL la tome con cualquiera de los dos.
 */
export function buildNota(
  titulo: string,
  contacto: { nombre?: string; apellido?: string; email?: string; telefono?: string },
  detalle: Record<string, string> = {},
  eventId = '',
): string {
  const fb = getStoredFbParams()
  const atribucion = [
    ['fbclid', fb.fbclid],
    ['utm_source', fb.utm_source],
    ['utm_medium', fb.utm_medium],
    ['utm_campaign', fb.utm_campaign],
    ['utm_content', fb.utm_content],
    ['utm_term', fb.utm_term],
    ['utm_id', fb.utm_id],
  ].filter(([, v]) => v)

  const sep = '------------------------------'
  return [
    `${titulo} — Masterclass Arlog`,
    sep,
    `Nombre: ${`${contacto.nombre ?? ''} ${contacto.apellido ?? ''}`.trim()}`,
    `Correo: ${contacto.email ?? ''}`,
    `WhatsApp: ${contacto.telefono ?? ''}`,
    ...(Object.keys(detalle).length ? [sep, ...Object.entries(detalle).map(([k, v]) => `${k}: ${v}`)] : []),
    sep,
    atribucion.length
      ? `Origen: ${atribucion.map(([k, v]) => `${k}=${v}`).join(' · ')}`
      : 'Origen: directo / orgánico (sin fbclid ni UTM)',
    `Fecha: ${new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`,
    ...(eventId ? [`event_id: ${eventId}`] : []),
  ].join('\n')
}

// Avance de etapa del mismo contacto por el webhook de contacto
export async function trackStage(etapa: string, data: Record<string, unknown>) {
  try {
    await postToGhl(GHL_CONTACT_WEBHOOK, {
      etapa,
      event_id: generateEventId('stage'),
      ...getStoredFbParams(),
      ...data,
    })
  } catch {
    // silencioso — nunca bloquear la UX por un fallo de tracking
  }
}

export function fbq(...args: unknown[]) {
  ;(window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.(...args)
}
