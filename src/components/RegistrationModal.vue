<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from 'libphonenumber-js'
import { getStoredFbParams } from '@/utils/fbclid'
import { sendCapiEvent } from '@/utils/capi'
import {
  GHL_CONTACT_WEBHOOK,
  GHL_QUALIFICATION_WEBHOOK,
  buildNota,
  generateEventId,
  postToGhl,
  fbq,
} from '@/utils/ghl'
import { useContactStore, type Situacion } from '@/stores/contact'
import { MASTERCLASS_NAME, MASTERCLASS_PRICE, masterclassDateLabel } from '@/config/masterclass'

const SITUACION_LABELS: Record<Situacion, string> = {
  ya_vendo: 'Ya vendo computadoras, impresoras o accesorios',
  quiero_empezar: 'Quiero empezar a venderlos',
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()
const contactStore = useContactStore()

// ── Países: Ecuador y LATAM primero ───────────────────────────────────────────
const PRIORITY: Record<string, string> = {
  EC: 'Ecuador',
  CO: 'Colombia',
  PE: 'Perú',
  MX: 'México',
  VE: 'Venezuela',
  BO: 'Bolivia',
  CL: 'Chile',
  AR: 'Argentina',
  PA: 'Panamá',
  US: 'Estados Unidos',
  ES: 'España',
}
const regionNames = new Intl.DisplayNames(['es'], { type: 'region' })
const countries = [
  ...Object.entries(PRIORITY).map(([code, name]) => ({ code, name })),
  ...getCountries()
    .filter((c) => !PRIORITY[c])
    .map((code) => ({ code, name: regionNames.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es')),
].map((c) => ({ ...c, dial: '+' + getCountryCallingCode(c.code as CountryCode) }))

const country = ref('EC')
const dial = computed(() => countries.find((c) => c.code === country.value)?.dial ?? '')

const form = ref({ nombre: '', apellido: '', email: '', phone: '', situacion: '' as Situacion | '' })
const errors = ref<Record<string, string>>({})
const submitting = ref(false)
const firstInput = ref<HTMLInputElement | null>(null)
const formEl = ref<HTMLFormElement | null>(null)

let opener: HTMLElement | null = null

// Prellenar si ya se registró antes en este dispositivo
watch(
  () => props.open,
  async (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (!open) {
      // Devolver el foco al botón que abrió el formulario
      opener?.focus({ preventScroll: true })
      opener = null
      return
    }
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const c = contactStore.contact
    if (c.email && !form.value.email) {
      form.value.nombre = c.nombre
      form.value.apellido = c.apellido
      form.value.email = c.email
      form.value.situacion = c.situacion
    }
    // En táctil no se enfoca solo: el teclado taparía el encabezado del formulario
    if (window.matchMedia('(pointer: fine)').matches) {
      await nextTick()
      firstInput.value?.focus()
    }
  },
)

const parsedPhone = computed(() =>
  parsePhoneNumberFromString(dial.value + form.value.phone.replace(/\D/g, ''), country.value as CountryCode),
)

const validators: Record<string, () => string | null> = {
  nombre: () => (form.value.nombre.trim().length < 2 ? 'Escribe tu nombre' : null),
  apellido: () => (form.value.apellido.trim().length < 2 ? 'Escribe tu apellido' : null),
  email: () => {
    const v = form.value.email.trim()
    if (!v) return 'Escribe tu correo'
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Ese correo no parece completo (ej. nombre@gmail.com)'
  },
  phone: () => {
    if (!form.value.phone.replace(/\D/g, '')) return 'Escribe tu número de WhatsApp'
    return parsedPhone.value?.isValid() ? null : 'Ese número no corresponde al país elegido'
  },
  situacion: () => (form.value.situacion ? null : 'Elige una opción'),
}

const check = (field: string) => {
  const msg = validators[field]?.()
  if (msg) errors.value[field] = msg
  else delete errors.value[field]
}

const handleSubmit = async () => {
  Object.keys(validators).forEach(check)
  const firstError = Object.keys(validators).find((f) => errors.value[f])
  if (firstError) {
    // En móvil el botón está al fondo de la hoja: llevar a la persona al primer error
    await nextTick()
    const el = formEl.value?.querySelector<HTMLElement>(`[data-field="${firstError}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.focus({ preventScroll: true })
    return
  }

  submitting.value = true
  const eventId = generateEventId('lead')
  const payload = {
    nombre: form.value.nombre.trim(),
    apellido: form.value.apellido.trim(),
    email: form.value.email.trim().toLowerCase(),
    telefono: parsedPhone.value?.format('E.164') ?? '',
    situacion: form.value.situacion as Situacion,
    pais: countries.find((c) => c.code === country.value)?.name ?? country.value,
    masterclass: MASTERCLASS_NAME,
    fecha_masterclass: masterclassDateLabel(),
    etapa: 'registro',
    tags: ['masterclass-importacion', 'step-1-registro'],
    timestamp: new Date().toISOString(),
    event_id: eventId,
    ...getStoredFbParams(),
  }
  const situacionLabel = SITUACION_LABELS[payload.situacion]
  const notaContacto = buildNota('NUEVO REGISTRO', payload, {
    País: payload.pais,
    Situación: situacionLabel,
    Clase: payload.fecha_masterclass,
    Siguiente: `Pago de $${MASTERCLASS_PRICE}`,
  }, eventId)

  // 1 — Contacto. 2 — Cualificación (actualiza el mismo contacto con su perfil).
  // En paralelo y sin bloquear: si GHL tarda, la persona igual sigue al pago.
  const qualEventId = generateEventId('qual')
  const yaVende = payload.situacion === 'ya_vendo'
  const notaQual = buildNota(yaVende ? 'CALIFICA' : 'NO CALIFICA', payload, {
    Situación: situacionLabel,
    Perfil: yaVende
      ? 'Ya vende tecnología y hoy le compra a un intermediario'
      : 'Quiere empezar a vender tecnología importada',
    Resultado: yaVende ? 'CALIFICA' : 'NO CALIFICA (nutrición)',
  }, qualEventId)
  await Promise.allSettled([
    postToGhl(GHL_CONTACT_WEBHOOK, { ...payload, nota: notaContacto, notas: notaContacto }),
    postToGhl(GHL_QUALIFICATION_WEBHOOK, {
      nombre: payload.nombre,
      apellido: payload.apellido,
      email: payload.email,
      telefono: payload.telefono,
      pais: payload.pais,
      situacion: payload.situacion,
      situacion_label: situacionLabel,
      perfil: yaVende ? 'revendedor_activo' : 'emprendedor_nuevo',
      // Califica = ya vende tecnología (lead caliente para importar con Arlog).
      // Quien quiere empezar sigue en la masterclass, pero va a nutrición.
      califica: yaVende,
      resultado: yaVende ? 'CALIFICA' : 'NO_CALIFICA',
      etapa: 'cualificacion',
      tags: [
        'masterclass-importacion',
        'step-2-cualificacion',
        yaVende ? 'califica' : 'no-califica',
        `situacion-${payload.situacion}`,
        yaVende ? 'perfil-ya-vende-tecnologia' : 'perfil-quiere-empezar',
      ],
      nota: notaQual,
      notas: notaQual,
      timestamp: payload.timestamp,
      event_id: qualEventId,
      ...getStoredFbParams(),
    }),
  ])

  // Sin value: la campaña optimiza por Purchase y el Lead no debe sumarse como ingreso
  const custom = { content_name: MASTERCLASS_NAME }
  fbq('track', 'Lead', custom, { eventID: eventId })
  sendCapiEvent(
    'Lead',
    eventId,
    {
      email: payload.email,
      phone: payload.telefono,
      firstName: payload.nombre,
      lastName: payload.apellido,
    },
    custom,
  )

  contactStore.save({
    nombre: payload.nombre,
    apellido: payload.apellido,
    email: payload.email,
    telefono: payload.telefono,
    situacion: payload.situacion,
  })
  submitting.value = false
  emit('close')
  router.push('/pago')
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled])'

const onKeydown = (e: KeyboardEvent) => {
  if (!props.open) return
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  // Mantener el Tab dentro del formulario (si no, se escapa al video de atrás)
  if (e.key !== 'Tab' || !formEl.value) return
  const items = [...formEl.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null && !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked && form.value.situacion),
  )
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  const inside = formEl.value.contains(document.activeElement)
  if (e.shiftKey && (document.activeElement === first || !inside)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
    e.preventDefault()
    first.focus()
  }
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Transition name="rmodal">
    <div v-if="open" class="rmodal" @click.self="emit('close')">
      <form
        ref="formEl"
        class="rmodal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rmodal-title"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <button type="button" class="rmodal__close" aria-label="Cerrar" @click="emit('close')">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <span class="rmodal__grab" aria-hidden="true"></span>
        <div class="rmodal__stripes" aria-hidden="true"><span></span><span></span><span></span></div>
        <p class="rmodal__step">Paso 1 de 2 · Tus datos</p>
        <h2 id="rmodal-title" class="rmodal__title">Reserva tu lugar en la masterclass</h2>
        <p class="rmodal__sub">
          {{ masterclassDateLabel() }} · En vivo · <strong>${{ MASTERCLASS_PRICE }}</strong>
        </p>

        <div class="rmodal__row">
          <label class="field">
            <span>Nombre</span>
            <input
              ref="firstInput"
              v-model="form.nombre"
              autocomplete="given-name"
              data-field="nombre"
              aria-describedby="err-nombre"
              :aria-invalid="!!errors.nombre"
              @blur="check('nombre')"
            />
            <small v-if="errors.nombre" id="err-nombre" role="alert">{{ errors.nombre }}</small>
          </label>
          <label class="field">
            <span>Apellido</span>
            <input
              v-model="form.apellido"
              autocomplete="family-name"
              data-field="apellido"
              aria-describedby="err-apellido"
              :aria-invalid="!!errors.apellido"
              @blur="check('apellido')"
            />
            <small v-if="errors.apellido" id="err-apellido" role="alert">{{ errors.apellido }}</small>
          </label>
        </div>

        <label class="field">
          <span>Correo</span>
          <input
            v-model="form.email"
            type="email"
            inputmode="email"
            autocomplete="email"
            data-field="email"
            aria-describedby="err-email"
            :aria-invalid="!!errors.email"
            @blur="check('email')"
          />
          <small v-if="errors.email" id="err-email" role="alert">{{ errors.email }}</small>
        </label>

        <div class="field">
          <span id="phone-label">WhatsApp</span>
          <div class="field__phone">
            <select v-model="country" aria-label="País" @change="check('phone')">
              <option v-for="c in countries" :key="c.code" :value="c.code">
                {{ c.name }} {{ c.dial }}
              </option>
            </select>
            <input
              v-model="form.phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel-national"
              aria-labelledby="phone-label"
              data-field="phone"
              aria-describedby="err-phone"
              placeholder="098 765 4321"
              :aria-invalid="!!errors.phone"
              @blur="check('phone')"
            />
          </div>
          <small v-if="errors.phone" id="err-phone" role="alert">{{ errors.phone }}</small>
        </div>

        <fieldset class="field field--choice">
          <legend>¿En qué punto estás?</legend>
          <label :class="{ 'is-on': form.situacion === 'ya_vendo' }">
            <input
              v-model="form.situacion"
              type="radio"
              name="situacion"
              value="ya_vendo"
              data-field="situacion"
              @change="check('situacion')"
            />
            <i class="fa-solid fa-store" aria-hidden="true"></i>
            Ya vendo computadoras, impresoras o accesorios
          </label>
          <label :class="{ 'is-on': form.situacion === 'quiero_empezar' }">
            <input
              v-model="form.situacion"
              type="radio"
              name="situacion"
              value="quiero_empezar"
              @change="check('situacion')"
            />
            <i class="fa-solid fa-seedling" aria-hidden="true"></i>
            Quiero empezar a venderlos
          </label>
          <small v-if="errors.situacion" id="err-situacion" role="alert">{{ errors.situacion }}</small>
        </fieldset>

        <button type="submit" class="btn btn--primary btn--block" :disabled="submitting">
          <template v-if="submitting"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Guardando</template>
          <template v-else>Continuar al pago de ${{ MASTERCLASS_PRICE }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></template>
        </button>
        <p class="rmodal__legal">
          Al continuar aceptas la
          <RouterLink to="/politicas-privacidad" target="_blank">política de privacidad</RouterLink>.
        </p>
      </form>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.rmodal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(2, 5, 20, 0.78);
  backdrop-filter: blur(6px);

  @include from('md') {
    align-items: center;
    padding: 1.5rem;
  }

  &__card {
    position: relative;
    width: 100%;
    max-width: 520px;
    max-height: 94dvh;
    overflow-y: auto;
    background: $AR-NAVY-800;
    border: 1px solid $AR-NAVY-600;
    border-radius: 18px 18px 0 0;
    padding: 1.75rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 1rem;

    @include from('md') {
      border-radius: 18px;
      padding: 2.25rem 2rem 2rem;
    }
  }

  &__grab {
    align-self: center;
    width: 40px;
    height: 4px;
    margin: -0.75rem 0 0.25rem;
    border-radius: 2px;
    background: $AR-NAVY-600;

    @include from('md') {
      display: none;
    }
  }

  &__close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: $AR-TEXT-MUTED;
    font-size: 1.2rem;
    cursor: pointer;
  }

  &__stripes {
    display: flex;
    gap: 4px;

    span {
      width: 28px;
      height: 5px;
      border-radius: 2px;
      transform: skewX(-12deg);
      background: $AR-BLUE;

      &:nth-child(2) {
        background: $AR-INDIGO;
        box-shadow: inset 0 0 0 1px rgba($white, 0.15);
      }
      &:nth-child(3) {
        background: $AR-ORANGE;
      }
    }
  }

  &__step {
    @include eyebrow;
    margin: 0;
    color: $AR-BLUE-LIGHT;
  }

  &__title {
    @include heading;
    font-size: 1.6rem;
    margin: -0.4rem 0 0;
    padding-right: 2rem;
  }

  &__sub {
    margin: -0.5rem 0 0.25rem;
    color: $AR-TEXT-MUTED;
    font-size: 0.95rem;

    strong {
      color: $AR-ORANGE-SOFT;
      font-family: $font-mono;
    }
  }

  &__row {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    @include from('md') {
      flex-direction: row;
      > * {
        flex: 1;
      }
    }
  }

  &__legal {
    margin: 0;
    text-align: center;
    font-size: 0.85rem;
    color: $AR-TEXT-DIM;

    a {
      display: inline-block;
      padding: 0.6rem 0.15rem; // área táctil cómoda sin mover el texto
      margin: -0.6rem 0;
    }
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  border: 0;
  margin: 0;
  padding: 0;

  > span,
  legend {
    font-size: 0.85rem;
    font-weight: 600;
    color: $AR-TEXT-MUTED;
    padding: 0;
    margin-bottom: 0.35rem;
  }

  input:not([type='radio']),
  select {
    width: 100%;
    min-height: 50px;
    padding: 0 0.9rem;
    border-radius: 10px;
    border: 1px solid $AR-NAVY-600;
    background: $AR-NAVY-900;
    color: $AR-TEXT;
    font-family: $font-body;
    font-size: 16px; // evita el zoom de iOS
    transition: border-color 0.15s ease;

    &:focus {
      outline: none;
      border-color: $AR-BLUE-LIGHT;
    }

    &::placeholder {
      color: $AR-TEXT-DIM; // ~4.9:1 sobre navy-900 (el gris del navegador daba 4.2:1)
      opacity: 1;
    }

    &[aria-invalid='true'] {
      border-color: $AR-ERROR;
    }
  }

  small {
    color: $AR-ERROR;
    font-size: 0.875rem;
  }

  &__phone {
    display: flex;
    gap: 0.5rem;

    select {
      flex: 0 0 8.5rem;
      padding-right: 0.25rem;
    }
  }

  &--choice label {
    position: relative; // ancla el radio oculto: al enfocarlo con teclado la página no salta
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 52px;
    padding: 0.7rem 0.9rem;
    margin-bottom: 0.5rem;
    border-radius: 10px;
    border: 1px solid $AR-NAVY-600;
    background: $AR-NAVY-900;
    font-size: 0.95rem;
    line-height: 1.35;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;

    input {
      position: absolute;
      inset: 0;
      margin: 0;
      opacity: 0;
      pointer-events: none;
    }

    i {
      color: $AR-BLUE-LIGHT;
      width: 1.2rem;
      text-align: center;
    }

    &.is-on {
      border-color: $AR-ORANGE;
      background: rgba($AR-ORANGE, 0.1);

      i {
        color: $AR-ORANGE-SOFT;
      }
    }

    &:has(input:focus-visible) {
      outline: 2px solid $AR-ORANGE-SOFT;
      outline-offset: 2px;
    }
  }
}

.rmodal-enter-active,
.rmodal-leave-active {
  transition: opacity 0.25s ease;

  .rmodal__card {
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }
}

.rmodal-enter-from,
.rmodal-leave-to {
  opacity: 0;

  .rmodal__card {
    transform: translateY(24px);
  }
}
</style>
