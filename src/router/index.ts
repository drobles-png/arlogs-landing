import { createRouter, createWebHistory, type RouteMeta } from 'vue-router'
import FunnelView from '../views/FunnelView.vue'

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title: string
    description: string
    noindex?: boolean
  }
}

// Canonical y og:url salen del dominio donde se sirva (aún no hay dominio definitivo)
const SITE_URL = window.location.origin

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0, behavior: 'instant' }),
  routes: [
    {
      path: '/',
      alias: '/masterclass',
      name: 'funnel',
      component: FunnelView,
      meta: {
        title: 'Masterclass de importación en vivo | Arlog',
        description:
          'Aprende a importar computadoras, impresoras y accesorios por tu cuenta: proveedor, traslado y aduana, y el costo real de cada unidad puesta en tu bodega. En vivo, $20.',
      } satisfies RouteMeta,
    },
    {
      path: '/pago',
      name: 'pago',
      component: () => import('../views/PagoView.vue'),
      meta: {
        title: 'Confirma tu lugar | Masterclass Arlog',
        description: 'Completa el pago de $20 para confirmar tu lugar en la masterclass de importación.',
        noindex: true,
      } satisfies RouteMeta,
    },
    {
      path: '/inscripcion-confirmada',
      name: 'confirmada',
      component: () => import('../views/ConfirmadaView.vue'),
      meta: {
        title: 'Lugar confirmado | Masterclass Arlog',
        description: 'Tu lugar en la masterclass de importación de Arlog está confirmado.',
        noindex: true,
      } satisfies RouteMeta,
    },
    {
      path: '/politicas-privacidad',
      name: 'privacy-policy',
      component: () => import('../views/PrivacyPolicyView.vue'),
      meta: {
        title: 'Política de privacidad | Arlog',
        description: 'Cómo Arlog trata tus datos personales conforme a la LOPDP del Ecuador.',
      } satisfies RouteMeta,
    },
    {
      path: '/aviso-legal',
      name: 'legal-notice',
      component: () => import('../views/LegalNoticeView.vue'),
      meta: {
        title: 'Aviso legal | Arlog',
        description: 'Aviso legal y condiciones de uso de la masterclass de Arlog.',
      } satisfies RouteMeta,
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// ── SEO dinámico por ruta ──────────────────────────────────────────────────────
const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

let firstNavigation = true

router.afterEach((to) => {
  const { title, description, noindex } = to.meta
  const url = SITE_URL + to.path
  document.title = title ?? 'Arlog'
  setMeta('name', 'description', description ?? '')
  setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
  setMeta('property', 'og:title', title ?? '')
  setMeta('property', 'og:description', description ?? '')
  setMeta('property', 'og:url', url)

  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = url

  // El PageView inicial ya lo dispara el Pixel en index.html; en la SPA hay que repetirlo
  if (!firstNavigation) {
    ;(window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.('track', 'PageView')
  }
  firstNavigation = false
})

export default router
