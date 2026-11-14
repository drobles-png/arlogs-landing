<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import StepShell from '@/components/StepShell.vue'
import { useContactStore } from '@/stores/contact'
import { sendCapiEvent } from '@/utils/capi'
import BookingCalendar from '@/components/BookingCalendar.vue'
import { buildNota, fbq, trackStage } from '@/utils/ghl'
import { confirmPayphone } from '@/utils/payphone'
import {
  MASTERCLASS_DATE,
  MASTERCLASS_NAME,
  MASTERCLASS_PRICE,
  SOCIAL,
  WHATSAPP_NUMBER,
  masterclassDateLabel,
  whatsappLink,
} from '@/config/masterclass'

// Payphone redirige aquí al terminar: /inscripcion-confirmada?id=<int>&clientTransactionId=<str>
// El pago se confirma en el servidor (api/payphone-confirm). Purchase solo con pago aprobado.
const PURCHASE_KEY = 'ar_purchase_at'
const route = useRoute()
const { contact } = useContactStore()
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)

// checking → approved | failed (rechazado/cancelado) | error (no se pudo confirmar) | nodata (sin parámetros)
const state = ref<'checking' | 'approved' | 'failed' | 'error' | 'nodata'>('checking')
const txId = ref('')

const calendarHref = computed(() => {
  if (!MASTERCLASS_DATE) return ''
  const start = new Date(MASTERCLASS_DATE)
  const end = new Date(start.getTime() + 90 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Masterclass de importación — Arlog',
    dates: `${fmt(start)}/${fmt(end)}`,
    details: 'Masterclass en vivo con Ángel, de Arlog. El enlace de acceso llega a tu correo y WhatsApp.',
  })
  return `https://calendar.google.com/calendar/render?${params}`
})

const helpHref = computed(
  () =>
    whatsappLink(
      `Hola, soy ${contact.nombre} ${contact.apellido}. Pagué la masterclass y no me aparece confirmado${txId.value ? ` (transacción ${txId.value})` : ''}.`,
    ) || SOCIAL.instagram,
)

const pasos = [
  { icon: 'fa-envelope-open-text', text: 'Revisa tu correo: ahí te llega la confirmación y el enlace de la clase.' },
  { icon: 'fa-brands fa-whatsapp', text: 'Te escribiremos por WhatsApp antes de empezar para recordarte.' },
  { icon: 'fa-box-open', text: 'Ten a mano el producto que quieres importar: lo vas a usar en el paso 3.' },
]

function firePurchase(transactionId: string, fallback: { email: string; phone: string }) {
  // Una sola vez por transacción, aunque recargue; el event_id fijo deja que Meta deduplique igual
  const key = `${PURCHASE_KEY}_${transactionId}`
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, String(Date.now()))
  } catch {
    /* sin storage: seguimos, el event_id fijo evita el doble conteo en Meta */
  }
  const email = contact.email || fallback.email
  const telefono = contact.telefono || fallback.phone
  const eventId = `purchase_${transactionId}`
  const custom = {
    content_name: MASTERCLASS_NAME,
    value: MASTERCLASS_PRICE,
    currency: 'USD',
    order_id: transactionId,
  }
  fbq('track', 'Purchase', custom, { eventID: eventId })
  sendCapiEvent(
    'Purchase',
    eventId,
    { email, phone: telefono, firstName: contact.nombre, lastName: contact.apellido },
    custom,
  )
  const datos = { ...contact, email, telefono }
  const nota = buildNota('PAGÓ LA MASTERCLASS', datos, {
    Total: `$${MASTERCLASS_PRICE} USD`,
    Pasarela: 'Payphone',
    Transacción: transactionId,
    Clase: masterclassDateLabel(),
  }, eventId)
  trackStage('pagado', {
    nombre: contact.nombre,
    apellido: contact.apellido,
    email,
    telefono,
    situacion: contact.situacion,
    payphone_transaction_id: transactionId,
    tags: ['masterclass-importacion', 'step-4-pagado', 'masterclass-pagado'],
    nota,
    notas: nota,
    event_id: eventId,
  })
}

onMounted(async () => {
  const id = String(route.query.id ?? '')
  const clientTx = String(route.query.clientTransactionId ?? '')
  if (!id || !clientTx) {
    // En local se puede ver el diseño de éxito con ?demo=1 (no dispara eventos)
    state.value = isLocal && route.query.demo ? 'approved' : 'nodata'
    return
  }
  txId.value = id
  try {
    // Apenas carga: Payphone reversa el cobro si no se confirma en 5 minutos
    const r = await confirmPayphone(id, clientTx, contact)
    if (r.approved) {
      state.value = 'approved'
      firePurchase(String(r.transactionId), { email: r.email, phone: r.phone })
    } else {
      state.value = r.statusCode === 2 || r.statusCode === 3 ? 'failed' : 'error'
    }
  } catch {
    state.value = 'error'
  }
})
</script>

<template>
  <StepShell>
    <div v-if="state === 'checking'" class="ok" role="status">
      <i class="fa-solid fa-spinner fa-spin ok__spin" aria-hidden="true"></i>
      <h1 class="ok__title">Confirmando tu pago…</h1>
      <p class="ok__muted">No cierres esta página, toma unos segundos.</p>
    </div>

    <div v-else-if="state !== 'approved'" class="ok">
      <div class="ok__badge ok__badge--warn" aria-hidden="true"><i class="fa-solid fa-exclamation"></i></div>
      <h1 class="ok__title">
        {{
          state === 'failed'
            ? 'Tu pago no se completó'
            : state === 'nodata'
              ? 'No encontramos un pago en este enlace'
              : 'No pudimos confirmar tu pago'
        }}
      </h1>
      <p class="ok__muted">
        {{
          state === 'failed'
            ? 'Payphone no aprobó el cobro. Puedes intentarlo de nuevo con otra tarjeta.'
            : state === 'nodata'
              ? 'Si ya pagaste, te llega la confirmación a tu correo. Si no, completa tu pago aquí.'
              : 'Si se te descontó el dinero, escríbenos con este número de transacción y lo revisamos.'
        }}
        <strong v-if="txId && state === 'error'"> Transacción: {{ txId }}</strong>
      </p>
      <RouterLink v-if="state !== 'error'" to="/pago" class="btn btn--primary">
        <i class="fa-solid fa-lock"></i> Ir al pago
      </RouterLink>
      <a :href="helpHref" target="_blank" rel="noopener" class="btn btn--ghost">
        <i :class="['fa-brands', WHATSAPP_NUMBER ? 'fa-whatsapp' : 'fa-instagram']"></i> Escríbenos
      </a>
    </div>

    <div v-else class="ok">
      <div class="ok__badge" aria-hidden="true"><i class="fa-solid fa-check"></i></div>
      <h1 class="ok__title">
        {{ contact.nombre ? `¡Listo, ${contact.nombre}!` : '¡Listo!' }} Tu lugar está confirmado
      </h1>
      <p class="ok__date"><i class="fa-regular fa-calendar"></i> {{ masterclassDateLabel() }}</p>

      <a v-if="calendarHref" :href="calendarHref" target="_blank" rel="noopener" class="btn btn--ghost">
        <i class="fa-regular fa-calendar-plus"></i> Agregar a mi calendario
      </a>

      <ol class="ok__steps">
        <li v-for="(p, i) in pasos" :key="i">
          <span class="ok__n">{{ i + 1 }}</span>
          <i :class="p.icon.startsWith('fa-brands') ? p.icon : `fa-solid ${p.icon}`"></i>
          <p>{{ p.text }}</p>
        </li>
      </ol>

      <p class="ok__close">
        Si al final prefieres que veamos tu caso juntos, me escribes y agendamos una reunión.
        Nos vemos en la clase. — Ángel
      </p>

      <BookingCalendar />

      <div class="ok__social">
        <a :href="SOCIAL.instagram" target="_blank" rel="noopener" class="btn btn--ghost">
          <i class="fa-brands fa-instagram"></i> Síguenos en Instagram
        </a>
      </div>
    </div>
  </StepShell>
</template>

<style scoped lang="scss">
.ok {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  text-align: center;

  &__badge {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: $AR-SUCCESS;
    color: $white;
    font-size: 1.8rem;
    box-shadow: 0 0 0 10px rgba($AR-SUCCESS, 0.15);
    animation: pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;

    &--warn {
      background: $AR-ORANGE;
      box-shadow: 0 0 0 10px rgba($AR-ORANGE, 0.15);
    }
  }

  &__spin {
    font-size: 2rem;
    color: $AR-BLUE-LIGHT;
  }

  &__muted {
    margin: -0.5rem 0 0;
    color: $AR-TEXT-MUTED;
    max-width: 34rem;
  }

  &__title {
    @include heading;
    font-size: clamp(1.7rem, 5.5vw, 2.3rem);
    margin: 0;
    text-wrap: balance;
  }

  &__date {
    margin: -0.5rem 0 0;
    color: $AR-ORANGE-SOFT;
    font-weight: 600;

    i {
      margin-right: 0.35rem;
    }
  }

  &__steps {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    text-align: left;

    li {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
      padding: 1rem 1.1rem;
      border-radius: 12px;
      background: $AR-NAVY-800;
      border: 1px solid $AR-NAVY-600;

      > i {
        color: $AR-BLUE-LIGHT;
        margin-top: 0.3rem;
        width: 1.1rem;
      }
    }

    p {
      margin: 0;
      font-size: 0.98rem;
    }
  }

  &__n {
    flex: none;
    font-family: $font-mono;
    font-size: 0.85rem;
    padding: 0.1rem 0.45rem;
    border-radius: 5px;
    background: $AR-NAVY-600;
    margin-top: 0.15rem;
  }

  &__close {
    margin: 0.5rem 0 0;
    color: $AR-TEXT-MUTED;
  }
}

@keyframes pop {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
}
</style>
