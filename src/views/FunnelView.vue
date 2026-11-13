<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import logo from '@/assets/logos/arlog-logo.webp'
import mark from '@/assets/logos/arlog-mark.webp'
import RegistrationModal from '@/components/RegistrationModal.vue'
import WistiaVideo from '@/components/WistiaVideo.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import { captureFbParams } from '@/utils/fbclid'
import {
  MASTERCLASS_PRICE,
  WISTIA_MEDIA_ID,
  masterclassDateLabel,
  masterclassDateShort,
} from '@/config/masterclass'

const modalOpen = ref(false)
const showSticky = ref(false)
const heroCta = ref<HTMLElement | null>(null)
const offer = ref<HTMLElement | null>(null)
const dateLabel = masterclassDateLabel()
const dateShort = masterclassDateShort()
const route = useRoute()

const openModal = () => (modalOpen.value = true)

const dudas = [
  { icon: 'fa-user-check', text: 'Cómo encontrar un proveedor y saber si es confiable.' },
  { icon: 'fa-shield-halved', text: 'Cómo pagarle sin arriesgar tu dinero.' },
  { icon: 'fa-truck-ramp-box', text: 'Quién se encarga de traer la carga y pasarla por aduana.' },
  {
    icon: 'fa-calculator',
    text: 'Cuánto te va a costar el producto cuando ya está aquí.',
    note: 'La que más plata hace perder',
  },
]

const pasos = [
  {
    n: '01',
    tone: 'blue',
    icon: 'fa-magnifying-glass-dollar',
    title: 'Tu proveedor',
    text: 'Cómo encontrar y verificar a tu proveedor, y cómo pagarle de forma segura.',
  },
  {
    n: '02',
    tone: 'indigo',
    icon: 'fa-ship',
    title: 'Traer tu mercadería',
    text: 'Cómo traer tu mercadería y quién hace cada parte del proceso, hasta la aduana.',
  },
  {
    n: '03',
    tone: 'orange',
    icon: 'fa-calculator',
    title: 'Tu costo real',
    text: 'Cómo calcular cuánto te cuesta de verdad cada unidad puesta en tu bodega.',
  },
]

// Barra de CTA fija en móvil: visible siempre que el botón del hero no esté en pantalla
// (también antes de llegar a él), hasta que aparece la tarjeta final con su propio botón.
// Se calcula en el scroll y no con IntersectionObserver: un scroll rápido puede saltar
// el botón entero sin que el observer dispare.
let revealer: IntersectionObserver | null = null
let raf = 0

const updateSticky = () => {
  raf = 0
  const cta = heroCta.value?.getBoundingClientRect()
  const card = offer.value?.getBoundingClientRect()
  if (!cta || !card) return
  const vh = window.innerHeight
  const ctaOnScreen = cta.bottom > 0 && cta.top < vh
  const reachedOffer = card.top < vh
  showSticky.value = !ctaOnScreen && !reachedOffer
}

const onScroll = () => {
  if (!raf) raf = requestAnimationFrame(updateSticky)
}

onMounted(() => {
  captureFbParams()

  // /pago enlaza a /?editar=1 para corregir los datos
  if (route.query.editar) openModal()

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  updateSticky()

  revealer = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in')
          revealer?.unobserve(e.target)
        }
      }),
    { rootMargin: '0px 0px -10% 0px' },
  )
  document.querySelectorAll('.reveal').forEach((el) => revealer?.observe(el))
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(raf)
  revealer?.disconnect()
})
</script>

<template>
  <div class="funnel">
    <!-- Barra superior -->
    <div class="topbar">
      <i class="fa-solid fa-video" aria-hidden="true"></i>
      <span class="topbar__long">Masterclass en vivo · <strong>{{ dateLabel }}</strong></span>
      <span class="topbar__short">En vivo · <strong>{{ dateShort }}</strong></span
      ><span>· ${{ MASTERCLASS_PRICE }}</span>
    </div>

    <!-- Hero -->
    <header class="hero">
      <div class="hero__glow" aria-hidden="true"></div>
      <div class="container hero__inner">
        <img :src="logo" alt="Arlogs — Improving Logistics" class="hero__logo" width="132" height="94" />

        <p class="hero__kicker">
          Si vendes computadoras, impresoras o accesorios, o quieres empezar
        </p>
        <h1 class="hero__title">
          Deja de comprarle a quien ya importó y
          <span class="hl">se queda con una buena parte de tu ganancia</span>
        </h1>
        <p class="hero__sub">
          Masterclass en vivo de 3 pasos para que salgas sabiendo hacer tu importación
          <strong>por tu cuenta</strong>.
        </p>

        <div class="hero__video">
          <WistiaVideo :media-id="WISTIA_MEDIA_ID" />
        </div>

        <div ref="heroCta" class="hero__cta">
          <button class="btn btn--primary hero__btn" @click="openModal">
            Inscribirme por ${{ MASTERCLASS_PRICE }} <i class="fa-solid fa-arrow-right"></i>
          </button>
          <p class="hero__meta">
            <i class="fa-regular fa-calendar" aria-hidden="true"></i> {{ dateLabel }}
          </p>
        </div>
      </div>
    </header>

    <!-- Dudas -->
    <section class="section section--alt">
      <div class="container">
        <p class="eyebrow reveal">Lo que siempre me preguntan</p>
        <h2 class="section__title reveal">
          Las personas que vienen a hablar conmigo tienen siempre las mismas dudas
        </h2>
        <ul class="dudas">
          <li
            v-for="(d, i) in dudas"
            :key="d.text"
            class="dudas__item reveal"
            :class="{ 'dudas__item--key': d.note }"
            :style="{ '--d': `${i * 70}ms` }"
          >
            <i class="fa-solid" :class="d.icon"></i>
            <p>
              <span v-if="d.note" class="dudas__note">{{ d.note }}</span>
              {{ d.text }}
            </p>
          </li>
        </ul>
      </div>
    </section>

    <!-- El costo real -->
    <section class="section">
      <div class="container cost">
        <div class="cost__copy">
          <p class="eyebrow reveal">El número que nadie te dice</p>
          <h2 class="section__title reveal">
            El precio del proveedor no es lo que te cuesta tu mercadería
          </h2>
          <p class="reveal">
            He visto mercadería de <strong>$1,500</strong> en China que llega puesta en Guayaquil en
            <strong>$2,157</strong>. Y he visto a un cliente que casi pone mal su precio
            porque le pidió el cálculo a la inteligencia artificial y le dio un número equivocado.
          </p>
        </div>

        <div class="ticket reveal" aria-label="Ejemplo de costo de importación">
          <div class="ticket__row">
            <span class="ticket__label"><i class="fa-solid fa-industry"></i> En China</span>
            <span class="ticket__num">$1,500</span>
          </div>
          <div class="ticket__route" aria-hidden="true">
            <i class="fa-solid fa-plane"></i><span></span><i class="fa-solid fa-ship"></i><span></span
            ><i class="fa-solid fa-truck"></i>
          </div>
          <div class="ticket__row ticket__row--total">
            <span class="ticket__label"><i class="fa-solid fa-location-dot"></i> En Guayaquil</span>
            <span class="ticket__num">$2,157</span>
          </div>
          <div class="ticket__diff">
            <span>Lo que no ves en el precio del proveedor</span>
            <strong>+$657</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- 3 pasos -->
    <section class="section section--alt">
      <div class="container">
        <p class="eyebrow reveal">Lo que vas a aprender</p>
        <h2 class="section__title reveal">Tu importación en 3 pasos</h2>
        <ol class="pasos">
          <li
            v-for="(p, i) in pasos"
            :key="p.n"
            class="paso reveal"
            :class="`paso--${p.tone}`"
            :style="{ '--d': `${i * 90}ms` }"
          >
            <div class="paso__top">
              <span class="paso__n">{{ p.n }}</span>
              <i class="fa-solid" :class="p.icon"></i>
            </div>
            <h3>{{ p.title }}</h3>
            <p>{{ p.text }}</p>
          </li>
        </ol>
        <div class="section__cta reveal">
          <button class="btn btn--primary" @click="openModal">
            Quiero aprender a importar <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </section>

    <!-- Ángel -->
    <section class="section">
      <div class="container about">
        <div class="about__visual reveal">
          <img :src="mark" alt="" width="764" height="455" loading="lazy" />
          <ul>
            <li><i class="fa-solid fa-plane-departure"></i> Aéreo</li>
            <li><i class="fa-solid fa-ship"></i> Marítimo</li>
            <li><i class="fa-solid fa-truck-fast"></i> Terrestre</li>
          </ul>
        </div>
        <div class="about__copy">
          <p class="eyebrow reveal">Quién da la clase</p>
          <h2 class="section__title reveal">Soy Ángel, de Arlog, y me dedico solo a importaciones</h2>
          <p class="reveal">
            Armé esta masterclass para que salgas sabiendo cómo hacer tu importación por tu cuenta.
            Si al final prefieres que veamos tu caso juntos, me escribes y agendamos una reunión.
          </p>
        </div>
      </div>
    </section>

    <!-- Por qué se cobra + cierre -->
    <section class="section section--close">
      <div class="container">
        <div ref="offer" class="offer reveal">
          <div class="offer__stripes" aria-hidden="true"><span></span><span></span><span></span></div>
          <p class="eyebrow">Por qué cuesta ${{ MASTERCLASS_PRICE }}</p>
          <blockquote>
            “Cobro la entrada a propósito, porque quiero que se conecten personas que de
            verdad están pensando en importar.”
          </blockquote>
          <dl class="offer__facts">
            <div>
              <dt>Fecha</dt>
              <dd>{{ dateLabel }}</dd>
            </div>
            <div>
              <dt>Formato</dt>
              <dd>En vivo</dd>
            </div>
            <div>
              <dt>Inversión</dt>
              <dd class="mono">${{ MASTERCLASS_PRICE }}</dd>
            </div>
          </dl>
          <button class="btn btn--primary btn--block" @click="openModal">
            Inscribirme aquí <i class="fa-solid fa-arrow-right"></i>
          </button>
          <p class="offer__foot">Nos vemos en la clase.</p>
        </div>
      </div>
    </section>

    <SiteFooter />

    <!-- CTA fija en móvil -->
    <Transition name="sticky">
      <div v-if="showSticky && !modalOpen" class="sticky">
        <div>
          <strong>Masterclass en vivo</strong>
          <span>{{ dateShort }}</span>
        </div>
        <button class="btn btn--primary" @click="openModal">Inscribirme ${{ MASTERCLASS_PRICE }}</button>
      </div>
    </Transition>

    <RegistrationModal :open="modalOpen" @close="modalOpen = false" />
  </div>
</template>

<style scoped lang="scss">
.funnel {
  overflow-x: clip;
}

.eyebrow {
  @include eyebrow;
  color: $AR-BLUE-LIGHT;
  margin: 0 0 0.9rem;
}

.hl {
  color: $AR-ORANGE-SOFT;
}

.mono {
  font-family: $font-mono;
}

// ── Topbar ──────────────────────────────────────────────────────────────────
.topbar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.6rem 1rem;
  background: $AR-ORANGE-ACTION;
  color: $white;
  font-size: 0.9rem;
  text-align: center;
  line-height: 1.3;

  &__long {
    display: none;

    @include from('md') {
      display: inline;
    }
  }

  &__short {
    @include from('md') {
      display: none;
    }
  }
}

// ── Hero ────────────────────────────────────────────────────────────────────
.hero {
  position: relative;
  padding: 1.25rem 0 3.5rem;

  @include from('md') {
    padding: 2.5rem 0 5rem;
  }

  &__glow {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(60% 40% at 15% 0%, rgba($AR-BLUE, 0.35), transparent 70%),
      radial-gradient(50% 35% at 90% 10%, rgba($AR-INDIGO, 0.5), transparent 70%);
    pointer-events: none;
  }

  &__inner {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 920px;
  }

  &__logo {
    width: 84px;
    height: auto;
    margin-bottom: 1.25rem;

    @include from('md') {
      width: 132px;
      margin-bottom: 1.75rem;
    }
  }

  &__kicker {
    margin: 0 0 0.75rem;
    max-width: 30ch;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.35;
    color: $AR-BLUE-LIGHT;
    text-wrap: balance;

    @include from('md') {
      max-width: none;
      font-size: 1.1rem;
    }
  }

  &__title {
    @include heading;
    font-size: clamp(1.85rem, 7.4vw, 3.6rem);
    margin: 0;
    text-wrap: balance;
  }

  &__sub {
    max-width: 680px;
    margin: 0.9rem 0 1.5rem;
    color: $AR-TEXT-MUTED;
    font-size: 1.1rem;
    text-wrap: pretty;

    strong {
      color: $AR-TEXT;
    }
  }

  &__video {
    width: 100%;
  }

  &__cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-top: 1.75rem;
    width: 100%;
  }

  &__btn {
    width: 100%;
    max-width: 420px;
    min-height: 62px;
    font-size: 1.15rem;
  }

  &__meta {
    margin: 0;
    font-size: 0.95rem;
    color: $AR-TEXT-MUTED;

    i {
      color: $AR-BLUE-LIGHT;
      margin-right: 0.3rem;
    }
  }
}

// ── Secciones ───────────────────────────────────────────────────────────────
.section {
  padding: 4rem 0;

  @include from('md') {
    padding: 6rem 0;
  }

  &--alt {
    background: $AR-NAVY-800;
    border-block: 1px solid rgba($AR-NAVY-600, 0.6);
  }

  &__title {
    @include heading;
    font-size: clamp(1.65rem, 4.2vw, 2.5rem);
    margin: 0 0 1.25rem;
    max-width: 760px;
    text-wrap: balance;
  }

  &__cta {
    display: flex;
    justify-content: center;
    margin-top: 2.5rem;

    .btn {
      width: 100%;
      max-width: 420px;
    }
  }

  p:not(.eyebrow) {
    color: $AR-TEXT-MUTED;
    max-width: 640px;

    strong {
      color: $AR-TEXT;
      font-family: $font-mono;
      font-weight: 500;
    }
  }
}

// ── Dudas ───────────────────────────────────────────────────────────────────
.dudas {
  list-style: none;
  padding: 0;
  margin: 2rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;

  &__item {
    flex: 1 1 100%;
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    padding: 1.25rem;
    border-radius: 14px;
    background: $AR-NAVY-700;
    border: 1px solid $AR-NAVY-600;

    @include from('md') {
      flex-basis: calc(50% - 0.45rem);
    }

    i {
      flex: none;
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: rgba($AR-BLUE, 0.25);
      color: $AR-BLUE-LIGHT;
    }

    p {
      margin: 0;
      color: $AR-TEXT;
      font-size: 1.05rem;
      line-height: 1.45;
      padding-top: 0.45rem;
    }

    &--key {
      border-color: rgba($AR-ORANGE, 0.7);
      background: linear-gradient(180deg, rgba($AR-ORANGE, 0.12), $AR-NAVY-700);

      i {
        background: rgba($AR-ORANGE, 0.2);
        color: $AR-ORANGE-SOFT;
      }

      p {
        padding-top: 0;
      }
    }
  }

  &__note {
    display: block;
    @include eyebrow;
    font-size: 0.75rem;
    color: $AR-ORANGE-SOFT;
    margin-bottom: 0.3rem;
  }
}

// ── Costo real ──────────────────────────────────────────────────────────────
.cost {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;

  @include from('lg') {
    flex-direction: row;
    align-items: center;
    gap: 4rem;

    > * {
      flex: 1;
    }
  }
}

.ticket {
  border-radius: 16px;
  padding: 1.5rem;
  background: $AR-NAVY-700;
  border: 1px solid $AR-NAVY-600;
  font-family: $font-mono;

  @include from('md') {
    padding: 2rem;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
  }

  &__label {
    font-family: $font-body;
    color: $AR-TEXT-MUTED;
    font-size: 0.95rem;

    i {
      color: $AR-BLUE-LIGHT;
      margin-right: 0.35rem;
    }
  }

  &__num {
    font-size: clamp(1.6rem, 7.5vw, 2.4rem);
    white-space: nowrap;
    font-weight: 500;
    color: $AR-TEXT;
  }

  &__row--total &__num {
    color: $AR-ORANGE-SOFT;
  }

  &__row--total &__label i {
    color: $AR-ORANGE-SOFT;
  }

  &__route {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 1.25rem 0;
    color: $AR-TEXT-DIM;
    font-size: 0.9rem;

    span {
      flex: 1;
      border-top: 1px dashed $AR-NAVY-600;
    }
  }

  &__diff {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid $AR-NAVY-600;
    font-family: $font-body;
    color: $AR-TEXT-MUTED;
    font-size: 0.95rem;

    strong {
      font-family: $font-mono;
      font-size: 1.3rem;
      color: $white;
      background: $AR-ORANGE-ACTION;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
    }
  }
}

// ── Pasos ───────────────────────────────────────────────────────────────────
.pasos {
  list-style: none;
  padding: 0;
  margin: 2rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @include from('md') {
    flex-direction: row;
  }
}

.paso {
  --tone: #{$AR-BLUE};
  flex: 1;
  position: relative;
  padding: 1.75rem 1.5rem 1.5rem;
  border-radius: 14px;
  background: $AR-NAVY-700;
  border: 1px solid $AR-NAVY-600;
  overflow: hidden;

  &--indigo {
    --tone: #{$AR-INDIGO-LIGHT};
  }

  &--orange {
    --tone: #{$AR-ORANGE-ACTION};
  }

  &__top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;

    i {
      font-size: 1.4rem;
      color: $AR-TEXT-MUTED;
    }
  }

  &__n {
    font-family: $font-mono;
    font-size: 0.85rem;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    background: var(--tone);
    color: $white;
  }

  h3 {
    @include heading;
    font-size: 1.35rem;
    margin: 0 0 0.5rem;
  }

  p {
    margin: 0;
  }
}

// ── Ángel ───────────────────────────────────────────────────────────────────
.about {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;

  @include from('lg') {
    flex-direction: row;
    align-items: center;
    gap: 4rem;

    > * {
      flex: 1;
    }
  }

  &__visual {
    padding: 2rem 1.5rem 1.5rem;
    border-radius: 18px;
    background: radial-gradient(80% 70% at 50% 30%, rgba($AR-BLUE, 0.3), transparent 70%),
      $AR-NAVY-800;
    border: 1px solid $AR-NAVY-600;

    img {
      width: 100%;
      max-width: 360px;
      height: auto;
      margin: 0 auto;
    }

    ul {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.5rem 1.25rem;
      list-style: none;
      padding: 0;
      margin: 1.5rem 0 0;
      font-size: 0.9rem;
      color: $AR-TEXT-MUTED;

      i {
        color: $AR-BLUE-LIGHT;
        margin-right: 0.3rem;
      }
    }
  }
}

// ── Oferta / cierre ─────────────────────────────────────────────────────────
.section--close {
  padding-top: 1rem;
  background:
    radial-gradient(50% 60% at 50% 100%, rgba($AR-ORANGE, 0.18), transparent 70%),
    $AR-NAVY-900;

  @include from('md') {
    padding-top: 2rem;
  }
}

.offer {
  max-width: 620px;
  margin: 0 auto;
  padding: 2rem 1.25rem;
  border-radius: 20px;
  background: $AR-NAVY-800;
  border: 1px solid $AR-NAVY-600;
  text-align: center;

  @include from('md') {
    padding: 3rem 2.5rem;
  }

  &__stripes {
    display: flex;
    justify-content: center;
    gap: 5px;
    margin-bottom: 1.25rem;

    span {
      width: 36px;
      height: 6px;
      border-radius: 2px;
      transform: skewX(-12deg);
      background: $AR-BLUE;

      &:nth-child(2) {
        background: $AR-INDIGO-LIGHT;
      }
      &:nth-child(3) {
        background: $AR-ORANGE;
      }
    }
  }

  blockquote {
    @include heading(700);
    font-size: clamp(1.25rem, 3.6vw, 1.6rem);
    line-height: 1.3;
    margin: 0 auto 2rem;
    color: $AR-TEXT;
    text-wrap: balance;
  }

  &__facts {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin: 0 0 2rem;
    text-align: left;

    div {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      background: $AR-NAVY-900;
    }

    dt {
      color: $AR-TEXT-DIM;
      font-size: 0.9rem;
    }

    dd {
      margin: 0;
      text-align: right;
      font-weight: 600;
    }
  }

  &__foot {
    margin: 1rem auto 0;
    color: $AR-TEXT-DIM;
    font-size: 0.9rem;
  }
}

// ── Sticky móvil ────────────────────────────────────────────────────────────
.sticky {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
  background: rgba($AR-NAVY-800, 0.96);
  backdrop-filter: blur(8px);
  border-top: 1px solid $AR-NAVY-600;

  @include from('md') {
    display: none;
  }

  div {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;

    strong {
      font-size: 0.9rem;
    }

    span {
      font-size: 0.75rem;
      color: $AR-TEXT-MUTED;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .btn {
    flex: none;
    min-height: 48px;
    padding: 0.6rem 1.1rem;
    font-size: 0.95rem;
  }
}

.sticky-enter-active,
.sticky-leave-active {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.sticky-enter-from,
.sticky-leave-to {
  transform: translateY(100%);
}

// ── Reveal al hacer scroll ──────────────────────────────────────────────────
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 0.6s ease var(--d, 0ms),
    transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0ms);

  &.is-in {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
  }
}
</style>
