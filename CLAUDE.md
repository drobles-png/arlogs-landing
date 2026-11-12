# Arlog — Funnel de masterclass de importación

## Proyecto
Landing / funnel de **Arlog (Arlogs Ecuador)**, empresa de importaciones (aéreo, marítimo, terrestre).
Instagram: https://www.instagram.com/arlogsecuador/ · Facebook: https://www.facebook.com/Arlogsecuador/

Vende una **masterclass en vivo de $10** dictada por **Ángel, de Arlog**, para quien vende (o quiere
vender) computadoras, impresoras y accesorios y hoy le compra a un importador intermediario.
Se armó a partir de la plantilla de funnel VSL de Bakano y se rebrandeó por completo:
no debe quedar ninguna mención a Bakano ni a otro cliente.

## Stack
Vue 3 + Vite 7 + TypeScript · SCSS · Pinia · vue-router · pnpm · Font Awesome 6 por CDN (sin emojis)
· función serverless de Vercel `api/capi.ts` (Meta Conversions API).

## Comandos
```bash
pnpm install
pnpm dev          # Vite en http://localhost:5173 (con --host para probar en el celular por la red local)
pnpm dev:api      # vercel dev: front + /api/capi juntos (requiere `vercel link` y .env.local)
pnpm type-check
pnpm build        # type-check + build
pnpm preview
pnpm format
```
`.claude/launch.json` tiene las dos configuraciones (`arlog-dev`, `arlog-dev-api`).

## Flujo
```
/  (FunnelView, alias /masterclass)   VSL Wistia + CTA "Inscribirme por $10"
  ↓ RegistrationModal (nombre, apellido, correo, WhatsApp, situación) → Lead
/pago (PagoView)                       resumen + Cajita de Payphone → InitiateCheckout
  ↓ Payphone redirige a /inscripcion-confirmada?id=…&clientTransactionId=…
/inscripcion-confirmada (ConfirmadaView) → confirma en /api/payphone-confirm → Purchase solo si statusCode 3 y $10
  ↓ opcional: calendario GHL "veamos tu caso juntos" (BookingCalendar) → Schedule
/politicas-privacidad · /aviso-legal
```
- `/pago` sin contacto guardado vuelve a `/` (salvo en localhost).
- Payphone: `api/payphone-order.ts` (fija el monto, 1000 centavos, y entrega token/storeId) y
  `api/payphone-confirm.ts` (confirma con Payphone; hay 5 min o reversa el cobro). Env vars en Vercel:
  `PAYPHONE_TOKEN`, `PAYPHONE_STORE_ID`. Sin ellas `/pago` muestra el plan B (WhatsApp/Instagram).
  En Payphone Developer (app WEB): dominio exacto + URL de respuesta `https://<dominio>/inscripcion-confirmada`.
  `vercel.json` manda `Referrer-Policy: origin-when-cross-origin` (lo exige la Cajita).
- Purchase: event_id `purchase_<transactionId>` (Meta deduplica aunque recargue) y `order_id`.
  Sin parámetros o pago no aprobado: no hay Purchase. En local, `?demo=1` muestra el éxito sin eventos.
- Lead va sin `value`: la campaña optimiza por **Purchase**.
- En localhost no se envía nada a GHL (consola `[GHL stub]`) salvo con `?ghl=1`; el Pixel y CAPI tampoco cargan.
- `api/capi.ts` rechaza otros dominios (403) y eventos fuera de la lista (400).

## Configuración (todo en un lugar)
- `src/config/masterclass.ts`: `MASTERCLASS_DAY` (`2026-12-03`), `MASTERCLASS_TIME` (HH:MM, vacío =
  "hora por confirmar"), precio (si cambia, también `AMOUNT_CENTS` en `api/payphone-*.ts`),
  `WISTIA_MEDIA_ID` (`hnck8wn24b`), `WHATSAPP_NUMBER`, redes, datos legales.
- `src/utils/ghl.ts`: `GHL_CONTACT_WEBHOOK`, `GHL_QUALIFICATION_WEBHOOK`, `GHL_BOOKING_CALENDAR`
  (vacíos = no se envía nada) y `buildNota()` (nota de texto para el CRM, va en `nota` y `notas`).
- Pixel `2202471354478065` en `index.html`. **No carga en localhost.**
- CAPI: `META_PIXEL_ID` y `META_CAPI_TOKEN` solo en `.env.local` / env vars de Vercel. Nunca con prefijo `VITE_`.

## Envíos a GHL (todos con fbclid, fbc, fbp, utm_*, event_id, tags y nota)
| Momento | Webhook | etapa | tags |
|---|---|---|---|
| Envía el formulario | contacto | `registro` | `step-1-registro` |
| Envía el formulario | cualificación | `cualificacion` (+ `califica` true/false, `resultado`) | `step-2-cualificacion`, `califica`/`no-califica`, `situacion-*`, `perfil-*` |
| Entra a /pago | contacto | `pago-iniciado` | `step-3-pago-iniciado` |
| Entra a /inscripcion-confirmada | contacto | `pagado` | `step-4-pagado`, `masterclass-pagado` |
| Agenda en el calendario | contacto | `reunion-agendada` | `step-5-reunion-agendada` |

Eventos Meta (Pixel + CAPI, mismo event_id): Lead, InitiateCheckout, Purchase, Schedule.
El calendario carga `form_embed.js` de GHL al abrirse (ajusta el alto del iframe).

## localStorage
| Clave | Contenido |
|---|---|
| `ar_contact` | `{ nombre, apellido, email, telefono, situacion, timestamp }` |
| `ar_purchase_at_<transactionId>` | timestamp del Purchase ya enviado para esa transacción |
| `ar_booked_at` | timestamp de la reunión agendada |
| `ar_fb` (sessionStorage) | fbclid, fbc, fbp, utm_* |

## Contenido (del VSL — no inventar más)
- Dolor: le compras a alguien que ya importó y se queda con buena parte de tu ganancia.
- Las 4 dudas: proveedor confiable · pagar sin arriesgar · quién trae la carga y la pasa por aduana ·
  cuánto cuesta puesto aquí (la que más plata hace perder).
- Ejemplo: $1,500 en China → $2,157 puesto en Guayaquil. Cliente que casi pone mal su precio por un
  cálculo de IA.
- 3 pasos: 1) encontrar/verificar proveedor y pagarle seguro 2) traer la mercadería y quién hace cada
  parte 3) costo real por unidad puesta en bodega.
- Por qué $10: "quiero que se conecten personas que de verdad están pensando en importar".
- Cierre: si prefieres que veamos tu caso juntos, me escribes y agendamos una reunión.

## Marca
Ver `docs/brand-guidelines.md`. Variables en `src/styles/colorVariables.module.scss` y
`fonts.modules.scss` (auto-inyectadas en cada `<style lang="scss">`; solo variables y mixins ahí,
lo que emite CSS va en `global.scss`).
- Logos: `src/assets/logos/arlog-logo.webp` (completo, fondo transparente) y `arlog-mark.webp`
  (solo los 3 paneles). Original en `brand/logo-original.png`; también `public/image.png` (favicon/og).

## GHL (subcuenta `arlogs`, locationId `TvW9G67TrCg2VD5ZORoO`)
Pipeline propio **Master Arlogs** (no el general de Bakano): `registro` → Registrado ·
`pago-iniciado` → Pago iniciado · `pagado` → Inscrito · `reunion-agendada` → Reunion Agendada.
Workflows: `OBTENER CONTACTO funnel tr` (ramas por etapa, cada una con su oportunidad) y
`obtener cualificacion | funnel` (ramas `califica` true/false **sin** acción de oportunidad: si la
tuviera, mandaría a Inscrito/Perdidos antes de pagar). Verificado el 12/11/2026 con el MCP de
HighLevel: un contacto y una oportunidad por persona, terminando en Pago iniciado. La Workflows API
no está habilitada en esta subcuenta (no se pueden leer ni crear workflows por API).

## Pendientes
Hora de la clase · credenciales de Payphone (token + storeId) y registrar dominio/URL de respuesta · mapear campos y publicar los workflows en GHL · razón social/RUC/correo legal ·
foto de Ángel · dominio (al tenerlo, cambiar `og:image` en index.html).
