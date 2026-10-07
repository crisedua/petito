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
- [x] **3 escenas bonus IA por historia** (antes 1): cada tema trae 3 prompts + sticker + frase propia
  (`models.py: THEMES[*].bonus_scenes`). Se generan en paralelo con stagger de 4s, reintentos ante
  503/429 del proxy fal y una segunda pasada secuencial para la que falle. Costo ~0.12 USD/historia.
- [x] **Música de fondo al ver la historia**: pistas instrumentales generadas en el navegador con
  Web Audio API (`frontend/src/lib/music.js`, sin archivos ni licencias). Una pista por tema
  (alegre / aventura / tierno / cueca / navidad), elegida automáticamente. Mute persistente
  (`localStorage cp_music_muted`) y autoavance tipo Instagram Stories (5s) con botón play/pausa.
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

## Changelog
- **2026-06 · Botón "Ver de nuevo" al terminar**: al llegar a la última diapositiva el slideshow se detenía y no se podía volver a reproducir. Ahora, al terminar, aparece un botón "Ver de nuevo" (`data-testid=story-replay-button`) sobre la última diapositiva y el control inferior derecho (`story-autoplay-toggle`) muestra un ícono de repetir (↻); ambos reinician la historia desde la diapositiva 1. El pausa/play a mitad de historia conserva la diapositiva actual. Verificado por testing_agent: 100% frontend.
- **2026-06 · Carrusel responsive + aviso de escenas IA**: (1) el slide ahora se dimensiona por ALTURA de viewport (`h-[58vh] max-h-[600px] aspect-[9/16]`) para que se vea completo en móvil sin cortarse (antes se cortaba por el ancho fijo 380px → 675px de alto). (2) Mientras las 3 escenas IA se generan (`bonus_pending`), `StoryCarousel` inyecta una diapositiva-placeholder ("Pintando escenas mágicas de {nombre}...") justo ANTES del cierre, así la historia no parece terminada; tras 45s aparece un mensaje de refuerzo. Las escenas entran solas vía polling y el placeholder desaparece al terminar. Verificado por testing_agent: 3/3 frontend OK (responsive móvil+desktop, navegación incl. tap, placeholder con nombre interpolado, polling 3s). Nota: el tool de screenshot recarga la página, por eso no reflejaba la navegación.
- **2026-06 · Música más motivadora**: reescribí el motor procedural (`lib/music.js`) de pads suaves a loops enérgicos — bombo four-on-the-floor, bajo con groove (sawtooth), palmas en contratiempo, hi-hats y leads brillantes; compresor en el master para pegada. Cada tema con su carácter (cueca en 6/8 festivo, navidad con campanitas). Sigue 100% procedural, sin archivos ni licencias; misma API (`trackForTheme`, `createMusicPlayer`) así que `StoryCarousel` no cambió.
- **2026-06 · Vista previa progresiva (perf)**: la historia central (título + fotos + cierre) ahora se publica apenas está lista (~15s, antes ~90s) y las 3 escenas IA se transmiten (stream) dentro del carrusel a medida que terminan. Backend: `run_pipeline` dividido, `generate_bonus_scenes` corre después de `preview_ready` con las 3 escenas 100% en paralelo (sin retardo escalonado) + un reintento paralelo. Nuevo campo `Story.bonus_pending` + polling en `Create.jsx`/`StoryView.jsx` con banner "Creando escenas mágicas...". Órdenes de slide: título=0, fotos=1..n, bonus=100+, cierre=9999. Verificado e2e: core en 15s, 9 slides al final.

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
3. Export MP4 vertical con la misma musiquita (requiere ffmpeg + render de audio server-side).
