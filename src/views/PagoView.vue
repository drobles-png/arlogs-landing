<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StepShell from '@/components/StepShell.vue'
import { useContactStore } from '@/stores/contact'
import { sendCapiEvent } from '@/utils/capi'
import { buildNota, fbq, generateEventId, trackStage } from '@/utils/ghl'
import { loadPayphone, type PayphoneOrder } from '@/utils/payphone'
import {
  MASTERCLASS_NAME,
  MASTERCLASS_PRICE,
  SOCIAL,
  masterclassDateLabel,
  whatsappLink,
} from '@/config/masterclass'

const router = useRouter()
const { contact } = useContactStore()
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)

// Cajita de Payphone: 'loading' → 'ready' | 'off' (sin credenciales: plan B) | 'error' | 'expired'
const payState = ref<'loading' | 'ready' | 'off' | 'error' | 'expired'>('loading')
let expiryTimer: ReturnType<typeof setTimeout> | undefined
// El formulario de Payphone vence a los 10 min: pasado eso se pide un intento nuevo
const PAYPHONE_TTL_MS = 9.5 * 60 * 1000

const waHref = whatsappLink(
  `Hola Ángel, soy ${contact.nombre} ${contact.apellido}. Me registré en la masterclass de importación y quiero pagar mis $${MASTERCLASS_PRICE}.`,
)

async function mountPayphone() {
  payState.value = 'loading'
  clearTimeout(expiryTimer)
  try {
    const res = await fetch('/api/payphone-order', { method: 'POST' })
    if (!res.ok) throw new Error(String(res.status))
    const order = (await res.json()) as PayphoneOrder
    if (!order.enabled) {
      payState.value = 'off'
      return
    }
    const PPaymentButtonBox = await loadPayphone()
    payState.value = 'ready'
    await nextTick()
    new PPaymentButtonBox({
      token: order.token,
      clientTransactionId: order.clientTransactionId,
      amount: order.amount,
      amountWithoutTax: order.amountWithoutTax,
      currency: order.currency,
      storeId: order.storeId,
      reference: order.reference,
      lang: 'es',
      defaultMethod: 'card',
      timeZone: -5,
      // Datos reales del comprador (Payphone rechaza datos fijos)
      email: contact.email || undefined,
      phoneNumber: contact.telefono || undefined,
    }).render('pp-button')
    expiryTimer = setTimeout(() => (payState.value = 'expired'), PAYPHONE_TTL_MS)
  } catch {
    // En local no hay /api (salvo con `pnpm dev:api`): se ve el plan B
    payState.value = isLocal ? 'off' : 'error'
  }
}

onMounted(() => {
  if (!contact.email && !isLocal) {
    router.replace('/')
    return
  }
  mountPayphone()

  const eventId = generateEventId('checkout')
  const custom = { content_name: MASTERCLASS_NAME, value: MASTERCLASS_PRICE, currency: 'USD' }
  fbq('track', 'InitiateCheckout', custom, { eventID: eventId })
  sendCapiEvent(
    'InitiateCheckout',
    eventId,
    {
      email: contact.email,
      phone: contact.telefono,
      firstName: contact.nombre,
      lastName: contact.apellido,
    },
    custom,
  )
  const nota = buildNota('PAGO INICIADO', contact, {
    Total: `$${MASTERCLASS_PRICE} USD`,
    Pasarela: 'Payphone (Cajita de pagos)',
  }, eventId)
  trackStage('pago-iniciado', {
    nombre: contact.nombre,
    apellido: contact.apellido,
    email: contact.email,
    telefono: contact.telefono,
    tags: ['masterclass-importacion', 'step-3-pago-iniciado'],
    nota,
    notas: nota,
    event_id: eventId,
  })
})
</script>

<template>
  <StepShell step="Paso 2 de 2 · Confirma tu lugar">
    <div class="pago">
      <h1 class="pago__title">
        {{ contact.nombre ? `${contact.nombre}, te` : 'Te' }} falta un paso para entrar a la clase
      </h1>
      <p class="pago__sub">
        Tu lugar queda reservado cuando completas el pago de ${{ MASTERCLASS_PRICE }}.
      </p>

      <div class="summary">
        <div class="summary__head">
          <i class="fa-solid fa-chalkboard-user"></i>
          <div>
            <strong>Masterclass de importación</strong>
            <span>Con Ángel, de Arlog</span>
          </div>
        </div>
        <ul>
          <li><i class="fa-regular fa-calendar"></i> {{ masterclassDateLabel() }}</li>
          <li><i class="fa-solid fa-video"></i> En vivo, en línea</li>
          <li><i class="fa-solid fa-list-ol"></i> Proveedor · Traslado y aduana · Costo real por unidad</li>
        </ul>
        <div class="summary__total">
          <span>Total</span>
          <strong>${{ MASTERCLASS_PRICE }}.00</strong>
        </div>
      </div>

      <!-- Cajita de Payphone: el formulario lo pinta Payphone dentro de #pp-button -->
      <div v-if="payState === 'loading'" class="paybox paybox--loading" role="status">
        <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Cargando el pago seguro…
      </div>
      <div v-show="payState === 'ready'" class="paybox">
        <p class="paybox__secure"><i class="fa-solid fa-lock" aria-hidden="true"></i> Pago seguro con Payphone</p>
        <div id="pp-button"></div>
      </div>
      <div v-if="payState === 'expired' || payState === 'error'" class="notice">
        <i class="fa-solid fa-circle-info"></i>
        <p v-if="payState === 'expired'">El formulario de pago venció por seguridad. Ábrelo de nuevo para pagar.</p>
        <p v-else>No pudimos cargar el pago. Inténtalo de nuevo o escríbenos.</p>
      </div>
      <button
        v-if="payState === 'expired' || payState === 'error'"
        type="button"
        class="btn btn--primary btn--block pago__btn"
        @click="mountPayphone"
      >
        <i class="fa-solid fa-rotate-right"></i> Volver a cargar el pago
      </button>

      <!-- Plan B: Payphone sin configurar, o error al cargar -->
      <template v-if="payState === 'off' || payState === 'error'">
        <div v-if="payState === 'off'" class="notice">
          <i class="fa-solid fa-circle-info"></i>
          <p>
            Recibimos tus datos. Te enviaremos el enlace de pago a tu WhatsApp
            <strong v-if="contact.telefono">{{ contact.telefono }}</strong> y a tu correo.
          </p>
        </div>
        <a v-if="waHref" :href="waHref" target="_blank" rel="noopener" class="btn btn--ghost btn--block">
          <i class="fa-brands fa-whatsapp"></i> Pagar por WhatsApp
        </a>
        <!-- Sin WhatsApp: al menos un canal directo para no dejar un callejón -->
        <a v-else :href="SOCIAL.instagram" target="_blank" rel="noopener" class="btn btn--ghost btn--block">
          <i class="fa-brands fa-instagram"></i> Escríbenos por Instagram
        </a>
      </template>

      <RouterLink :to="{ path: '/', query: { editar: '1' } }" class="pago__edit">
        <i class="fa-solid fa-pen" aria-hidden="true"></i> Corregir mis datos
      </RouterLink>
    </div>
  </StepShell>
</template>

<style scoped lang="scss">
.pago {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  text-align: center;

  &__title {
    @include heading;
    font-size: clamp(1.7rem, 5.5vw, 2.3rem);
    margin: 0;
    text-wrap: balance;
  }

  &__sub {
    margin: -0.5rem 0 0.5rem;
    color: $AR-TEXT-MUTED;
  }

  &__btn {
    min-height: 60px;
  }

  &__edit {
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 44px;
    padding: 0 0.75rem;
    font-size: 0.95rem;
    color: $AR-TEXT-MUTED;
  }
}

.summary {
  text-align: left;
  border-radius: 16px;
  background: $AR-NAVY-800;
  border: 1px solid $AR-NAVY-600;
  overflow: hidden;

  &__head {
    display: flex;
    gap: 0.9rem;
    align-items: center;
    padding: 1.25rem;
    border-bottom: 1px solid $AR-NAVY-600;

    > i {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 10px;
      background: rgba($AR-ORANGE, 0.18);
      color: $AR-ORANGE-SOFT;
      font-size: 1.15rem;
    }

    div {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }

    span {
      font-size: 0.9rem;
      color: $AR-TEXT-MUTED;
    }
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    font-size: 0.95rem;
    color: $AR-TEXT-MUTED;

    li {
      display: flex;
      gap: 0.6rem;
      line-height: 1.4;
    }

    i {
      width: 1.1rem;
      margin-top: 0.2rem;
      color: $AR-BLUE-LIGHT;
    }
  }

  &__total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 1rem 1.25rem;
    background: $AR-NAVY-700;

    strong {
      font-family: $font-mono;
      font-size: 1.6rem;
      font-weight: 500;
      color: $AR-ORANGE-SOFT;
    }
  }
}

.paybox {
  text-align: left;
  border-radius: 16px;
  background: $white;
  color: #1a1a1a;
  padding: 1rem;

  &--loading {
    text-align: center;
    background: $AR-NAVY-800;
    border: 1px solid $AR-NAVY-600;
    color: $AR-TEXT-MUTED;
    padding: 1.5rem 1rem;

    i {
      margin-right: 0.4rem;
    }
  }

  &__secure {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: #2b3a55;

    i {
      margin-right: 0.35rem;
    }
  }
}

.notice {
  display: flex;
  gap: 0.75rem;
  text-align: left;
  padding: 1rem 1.1rem;
  border-radius: 12px;
  background: rgba($AR-BLUE, 0.18);
  border: 1px solid rgba($AR-BLUE-LIGHT, 0.35);

  i {
    color: $AR-BLUE-LIGHT;
    margin-top: 0.3rem;
  }

  p {
    margin: 0;
    font-size: 0.95rem;
  }
}
</style>
