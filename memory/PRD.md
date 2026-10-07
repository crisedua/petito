# Cuentapatas — PRD

Positioning: **"Tu mascota cuenta su historia."** · Mobile-first PWA (español de Chile).

## Original problem statement
Demo-grade MVP: un dueño sube hasta 20 fotos de su mascota y en <90s recibe una historia
vertical (carrusel 1080×1920) con frases en la voz de la mascota y humor chileno, 1-2 escenas
bonus estilizadas por IA, preview gratis (2 slides) + paywall 3.990 CLP, y compartir en
WhatsApp/Instagram. Sin cuentas, sin suscripciones, sin app nativa.

## Architecture
- **Frontend**: React (CRA + craco), Tailwind, framer-motion, lucide-react, sonner. PWA
  (manifest + service worker). Mobile frame max-w-md. Rutas: `/`, `/crear`, `/h/:slug`, `/admin`.
- **Backend**: FastAPI + Motor (MongoDB). Pipeline server-side como background task (asyncio).
  Fotos/slides en `/app/backend/uploads/{story_id}` (privado), servidos por `/api/media`.
- **IA**: Claude `claude-sonnet-5-5` (visión selección fotos + escritura de frases) vía Emergent
  Universal Key (emergentintegrations). Escenas bonus: `fal-ai/nano-banana/edit` vía proxy Emergent.
- **Pago**: `PaymentProvider` interface. DEMO activo (desbloqueo instantáneo). MercadoPago Checkout
  Pro implementado y listo (falta Test Access Token + Webhook Secret del usuario).
- **Render**: Pillow, slides 1080×1920 (título, foto+frase, bonus, cierre con loop viral), variante
  bloqueada con blur + watermark "VISTA PREVIA".

## Data model (MongoDB)
`stories`, `photos`, `slides`, `generation_logs` (tokens, cost_usd, duration_ms por paso).

## User personas
- **Dueño de mascota** (red WhatsApp del fundador): crea y comparte una historia divertida.
- **Fundador/Admin**: ve historias, costo IA por historia y conversión en `/admin`.

## Core requirements (static)
- Flujo: landing → datos mascota → tema → fotos → progreso → preview (2 gratis + resto bloqueado)
  → paywall 3.990 CLP → desbloqueo → descarga + compartir.
- Costo IA por historia < 600 CLP (logueado). Límite 3 previews gratis por dispositivo/día.
- Fotos privadas, aviso "se borran en 7 días". Admin protegido por contraseña.

## Implemented (2026-06)
- [x] **FREE por ahora** (`FREE_MODE=true`): sin paywall, todas las diapositivas desbloqueadas
  (`paid=true`). El código de paywall/Mercado Pago queda intacto para reactivarlo luego.
- [x] **Render rediseñado** (no es "solo foto + texto"): identidad visual por tema (confeti, montañas,
  sol, guirnalda de banderas chilenas, nieve), portada con la mejor foto, layouts alternados
  (full-bleed y polaroid), "sticker" corto por slide generado por el modelo, viñeta + grano.
- [x] Landing con historia de ejemplo animada y CTA.
- [x] Wizard: datos mascota (nombre, especie, hasta 3 rasgos), 5 temas, selector de hasta 20 fotos.
- [x] Pipeline completo: visión (Claude) + frases chilenas (Claude) + escena bonus (fal.ai) + render.
- [x] Pantalla de progreso animada con pasos reales del backend.
- [x] Preview con marca de agua + paywall + desbloqueo (demo).
- [x] Página pública por slug, descarga de slides, Web Share / WhatsApp, email opcional.
- [x] Registro de costo por llamada IA (~34-51 CLP/historia observado).
- [x] Rate limit 3/día/dispositivo. Admin con KPIs (historias, conversión, ingresos, costo IA) + tabla.
- [x] PWA instalable (manifest + service worker + íconos). Todo en español de Chile.
- [x] Testing: 10/10 backend pytest + e2e frontend (100%).

## Credentials
Admin password `Cuentapatas.2026` (ver `/app/memory/test_credentials.md`).

## Backlog
- **P1**: Conectar Mercado Pago real (requiere Test Access Token + Webhook Secret del usuario).
- **P1**: Tarea de mantención (cron) para borrar fotos originales > 7 días.
- **P2**: Export MP4 vertical con música (ffmpeg/Remotion).
- **P2**: Pruebas de precio 2.990 / 4.990 CLP; más estilos de escenas bonus.
- **P2**: Más temas estacionales.
- **P3 (fase 3)**: App nativa con escaneo de carrete, productos impresos, múltiples mascotas.

## Next tasks
1. Conectar credenciales de Mercado Pago y validar webhook de pago real.
2. Agregar limpieza programada de fotos a los 7 días.
