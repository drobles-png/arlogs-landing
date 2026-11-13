// Datos de la masterclass de Arlog. Todo lo que cambie entre ediciones vive aquí.

// Fecha de la clase (AAAA-MM-DD) y hora de inicio en Ecuador (HH:MM, 24 h).
// Sin hora se muestra "hora por confirmar". Sin fecha, "Fecha por confirmar".
export const MASTERCLASS_DAY = '2026-12-03'
export const MASTERCLASS_TIME = '20:00'

// ISO completo con -05:00 (vacío si falta la hora): lo usa el botón "Agregar a Google Calendar"
export const MASTERCLASS_DATE =
  MASTERCLASS_DAY && MASTERCLASS_TIME ? `${MASTERCLASS_DAY}T${MASTERCLASS_TIME}:00-05:00` : ''

export const MASTERCLASS_PRICE = 20
export const MASTERCLASS_CURRENCY = 'USD'
export const MASTERCLASS_NAME = 'Masterclass: Importa tu tecnología desde China'

// Pago: Cajita de Payphone en /pago (api/payphone-order.ts y api/payphone-confirm.ts).
// Credenciales PAYPHONE_TOKEN y PAYPHONE_STORE_ID solo en Vercel. Sin ellas, /pago muestra el plan B
// (WhatsApp / Instagram). URL de respuesta en Payphone: https://<dominio>/inscripcion-confirmada
// Si cambia el precio, cambia también AMOUNT_CENTS en los dos archivos de api/.

// VSL de Ángel en Wistia
export const WISTIA_MEDIA_ID = 'hnck8wn24b'

// WhatsApp de Arlog en formato internacional sin "+" (ej. 593987654321). Vacío = se oculta.
export const WHATSAPP_NUMBER = '593958625891'

export const SOCIAL = {
  instagram: 'https://www.instagram.com/arlogsecuador/',
  facebook: 'https://www.facebook.com/Arlogsecuador/',
}

// Entidad legal para políticas — PENDIENTE confirmar razón social y RUC
export const LEGAL = {
  name: 'Arlog',
  razonSocial: 'Por confirmar',
  ruc: 'Por confirmar',
  ciudad: 'Guayaquil, Ecuador',
  email: 'Por confirmar',
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Guayaquil',
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Guayaquil',
}

// Mediodía en Ecuador: así el día no se corre al formatear en otra zona horaria
const classDay = () => new Date(`${MASTERCLASS_DAY}T${MASTERCLASS_TIME || '12:00'}:00-05:00`)

export function masterclassDateLabel(): string {
  if (!MASTERCLASS_DAY) return 'Fecha por confirmar'
  const d = classDay()
  const date = d.toLocaleDateString('es-EC', DATE_FORMAT)
  const time = MASTERCLASS_TIME
    ? `${d.toLocaleTimeString('es-EC', TIME_FORMAT)} (hora Ecuador)`
    : 'hora por confirmar'
  return `${date.charAt(0).toUpperCase()}${date.slice(1)} · ${time}`
}

// Versión corta para espacios estrechos (barra fija en móvil): "Mié 12 nov · 19:00"
export function masterclassDateShort(): string {
  if (!MASTERCLASS_DAY) return 'Fecha por confirmar'
  const d = classDay()
  const date = d.toLocaleDateString('es-EC', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Guayaquil',
  })
  const short = `${date.charAt(0).toUpperCase()}${date.slice(1).replace(/\./g, '')}`
  return MASTERCLASS_TIME ? `${short} · ${d.toLocaleTimeString('es-EC', TIME_FORMAT)}` : short
}

export function whatsappLink(text: string): string {
  if (!WHATSAPP_NUMBER) return ''
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
}
