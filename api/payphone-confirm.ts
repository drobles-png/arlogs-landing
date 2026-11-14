import type { VercelRequest, VercelResponse } from '@vercel/node'

// Confirma con Payphone el pago que vuelve a /inscripcion-confirmada?id=…&clientTransactionId=…
// Payphone reversa el cobro si no se confirma en los primeros 5 minutos: la página lo llama apenas carga.
// Confirmar es idempotente del lado de Payphone (recargar la página devuelve el mismo estado).
// Solo con statusCode 3 (Approved) y el monto correcto la página dispara Purchase.

const AMOUNT_CENTS = 2000 // debe coincidir con payphone-order.ts
const CONFIRM_URL = 'https://paymentbox.payphonetodoesposible.com/api/confirm'

function hostOf(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value).host
  } catch {
    return undefined
  }
}

function isSameOrigin(req: VercelRequest): boolean {
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host
  const origin = hostOf(req.headers.origin as string | undefined) ?? hostOf(req.headers.referer)
  return Boolean(host && origin && origin === host)
}

// Agenda la clase en el calendario de GHL solo con pago aprobado (lo verifica este servidor).
// Sin GHL_API_TOKEN (Private Integration de la subcuenta) no hace nada. Recargar no duplica la cita.
const GHL_API = 'https://services.leadconnectorhq.com'
const GHL_LOCATION_ID = 'TvW9G67TrCg2VD5ZORoO'
const GHL_CLASS_CALENDAR_ID = 'hwH6JrfPWbsy2UXGUzGa' // calendario de clase "Masterclass Arlog"
const CLASS_START = '2026-12-03T20:00:00-05:00' // = MASTERCLASS_DAY + MASTERCLASS_TIME
const CLASS_END = '2026-12-03T21:30:00-05:00'

interface Attendee {
  email: string
  phone: string
  firstName: string
  lastName: string
}

async function bookClass(a: Attendee): Promise<boolean> {
  const token = process.env.GHL_API_TOKEN
  const calendarId = GHL_CLASS_CALENDAR_ID
  if (!token || (!a.email && !a.phone)) return false
  const ghl = (path: string, version: string, init?: RequestInit) =>
    fetch(`${GHL_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Version: version, 'Content-Type': 'application/json' },
    })

  const up = await ghl('/contacts/upsert', '2021-07-28', {
    method: 'POST',
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, ...a }),
  })
  const contactId = ((await up.json()) as { contact?: { id?: string } }).contact?.id
  if (!contactId) {
    console.error('[ghl] upsert', up.status)
    return false
  }

  const prev = await ghl(`/contacts/${contactId}/appointments`, '2021-07-28')
  const events = ((await prev.json()) as { events?: { calendarId?: string }[] }).events ?? []
  if (events.some((e) => e.calendarId === calendarId)) return true

  const appt = await ghl('/calendars/events/appointments', '2021-04-15', {
    method: 'POST',
    body: JSON.stringify({
      calendarId,
      locationId: GHL_LOCATION_ID,
      contactId,
      startTime: CLASS_START,
      endTime: CLASS_END,
      appointmentStatus: 'confirmed',
      toNotify: true,
    }),
  })
  if (!appt.ok) console.error('[ghl] appointment', appt.status, await appt.text())
  return appt.ok
}

interface PayphoneConfirm {
  statusCode?: number
  transactionStatus?: string
  transactionId?: number
  clientTransactionId?: string
  amount?: number
  email?: string
  phoneNumber?: string
  optionalParameter4?: string // nombre del titular, cuando Payphone lo envía
  message?: string
  errorCode?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!isSameOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const token = process.env.PAYPHONE_TOKEN
  if (!token) {
    res.status(503).json({ approved: false, error: 'Payphone no configurado' })
    return
  }

  const { id, clientTransactionId, contact } = (req.body ?? {}) as {
    id?: unknown
    clientTransactionId?: unknown
    contact?: Partial<Record<'nombre' | 'apellido' | 'email' | 'telefono', unknown>>
  }
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0 || typeof clientTransactionId !== 'string' || !clientTransactionId) {
    res.status(400).json({ approved: false, error: 'id y clientTransactionId son requeridos' })
    return
  }

  try {
    const ppRes = await fetch(CONFIRM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: numericId, clientTxId: clientTransactionId }),
    })
    const data = (await ppRes.json()) as PayphoneConfirm
    const approved = ppRes.ok && data.statusCode === 3 && data.amount === AMOUNT_CENTS

    const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 120) : '')
    let booked = false
    if (approved) {
      try {
        booked = await bookClass({
          email: str(contact?.email) || data.email || '',
          phone: str(contact?.telefono) || data.phoneNumber || '',
          firstName: str(contact?.nombre),
          lastName: str(contact?.apellido),
        })
      } catch (e) {
        console.error('[ghl] book', e)
        // El pago ya está confirmado: un fallo de GHL no debe romper la página
      }
    }

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      approved,
      booked,
      status: data.transactionStatus ?? (ppRes.ok ? 'Unknown' : 'Error'),
      statusCode: data.statusCode ?? null,
      transactionId: data.transactionId ?? numericId,
      clientTransactionId: data.clientTransactionId ?? clientTransactionId,
      amount: data.amount ?? null,
      // Respaldo si la persona pagó en otro dispositivo y no hay contacto guardado
      email: data.email ?? '',
      phone: data.phoneNumber ?? '',
      message: data.message ?? '',
    })
  } catch {
    res.status(502).json({ approved: false, error: 'No se pudo confirmar con Payphone' })
  }
}
