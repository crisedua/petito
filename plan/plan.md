# Cuentapatas — "Tu mascota cuenta su historia"

App web móvil (PWA) en español de Chile donde el dueño sube hasta 20 fotos de su mascota y en menos de 90 segundos recibe una historia vertical compartible, con frases escritas en la voz de la mascota y humor chileno.
Historia demo-grade para validar demanda: preview gratis, pago único de 3.990 CLP para desbloquear todo, y botón para compartir en WhatsApp e Instagram.

## Para quién es
Dueños de mascotas en Chile (red de WhatsApp del fundador) que quieren un recuerdo divertido y compartible de su perro o gato, sin crear cuenta ni instalar nada. También una vista de administración para el fundador, que necesita ver cuántas historias se crearon, cuánto costó cada una en IA, y la conversión a pago.

## Funcionalidades y experiencia principal
- **Landing** con el titular, una historia de ejemplo y el botón "Crea la historia de tu mascota".
- **Datos de la mascota**: nombre, especie (perro, gato, otro) y 1 a 3 rasgos elegidos como chips (regalón, glotón, flojo, aventurero, mañoso, guardián, payaso).
- **Elección de tema** (1 de 5): Mi año, Mis aventuras, Un día en mi vida, Dieciochero, Navidad.
- **Selector de fotos** desde la galería del teléfono (hasta 20), con miniaturas y opción de quitar fotos.
- **Pipeline de IA server-side** con pantalla de progreso divertida ("Eligiendo tus mejores fotos…", "Escribiendo tu historia…"):
  1. Selección de fotos con visión (Claude): puntúa cada foto y elige las mejores 6 a 8, ordenándolas en un arco narrativo según el tema.
  2. Escritura de la historia (Claude): título y una frase por slide, en primera persona como la mascota, español chileno, cálido y gracioso, máximo 20 palabras, sin groserías.
  3. Escenas bonus (fal.ai): 1 o 2 imágenes estilizadas de la mascota según el tema (por ejemplo, de huaso para Dieciochero), conservando sus colores y marcas.
  4. Render de slides verticales 1080×1920: foto + frase, slide de título, slide de cierre con marca y "Crea la de tu mascota en [url]" (loop viral).
- **Preview gratis**: se ven los 2 primeros slides limpios y el resto con marca de agua / difuminado.
- **Paywall y pago**: desbloqueo pagando 3.990 CLP con Mercado Pago (Checkout Pro). El pago se confirma por webhook server-to-server, no por la redirección.
- **Historia desbloqueada**: carrusel completo sin marca de agua, descarga de todos los slides como imágenes, y botón compartir (Web Share API). Campo de email opcional para recibir el link.
- **Costo por historia registrado**: cada llamada de IA guarda tokens, costo estimado y duración, con guardrail objetivo bajo 600 CLP por historia.
- **Admin protegido por contraseña**: lista de historias con estado, costo de IA, pagadas vs no pagadas y tasa de conversión.
- **Privacidad**: las fotos nunca son públicas hasta compartir; aviso claro "Tus fotos se borran en 7 días".
- **Límite de abuso**: máximo 3 previews gratis por dispositivo al día para cuidar el costo de IA.

## Flujo de usuario
1. Entra al landing y toca "Crea la historia de tu mascota".
2. Ingresa nombre, especie y rasgos de su mascota.
3. Elige uno de los 5 temas.
4. Selecciona fotos desde su galería (hasta 20) y revisa las miniaturas.
5. Toca "Crear historia" y ve la pantalla de progreso mientras corre el pipeline.
6. Ve la preview: primeros slides claros, el resto con marca de agua.
7. Toca pagar, completa el pago en Mercado Pago y vuelve a la app.
8. Al confirmarse el pago, se desbloquea el carrusel completo: descarga y comparte.

## Sensación de UI/UX
Móvil primero, cálido, lúdico y chileno. Copys cortos y amistosos en español de Chile. Experiencia tipo "historia de Instagram": slides verticales, carrusel con gestos, animaciones suaves en transiciones y en la pantalla de progreso. Instalable como PWA. Prioridad a que funcione fluido en un Android de gama media sobre 4G.

## Fases de implementación
**Fase 1 — MVP (se construye ahora):**
- Landing, datos de la mascota, elección de tema y selector/carga de fotos.
- Pipeline completo: selección de fotos con visión + escritura de frases (Claude), escenas bonus (fal.ai, detrás de feature flag), y render de slides verticales con marca de agua en la preview.
- Página de preview con historia parcial y paywall.
- Pago con Mercado Pago + webhook + desbloqueo de la historia completa.
- Página pública de la historia con descarga de slides y compartir (Web Share API) + email opcional.
- Registro de costo por cada llamada de IA y límite de 3 previews gratis por dispositivo al día.
- Página de admin protegida por contraseña con estado, costo y conversión.
- PWA instalable (manifest + service worker) y copys en español chileno.

**Fase 2 (después):**
- Exportar la historia como video MP4 vertical con música.
- Más temas y variantes estacionales; pruebas de precio (2.990 / 4.990 CLP).
- Mejoras de calidad del render y más estilos de escenas bonus.

**Fase 3 (después):**
- App nativa con escaneo automático del carrete, productos impresos y múltiples mascotas por historia.

## Supuestos
- **Stack adaptado**: el brief sugiere Next.js + Supabase + Vercel; se construye sobre el stack disponible (React + FastAPI + MongoDB). Las fotos se guardan en almacenamiento de objetos privado, no en un bucket de Supabase. El comportamiento para el usuario es el mismo.
- **IA con Claude Sonnet** vía Emergent Universal Key para visión (selección de fotos) y texto (frases), sin que el usuario entregue su propia key.
- **Escenas bonus con fal.ai** vía Emergent Universal Key, detrás de un feature flag para poder apagarlas si el costo o la latencia suben.
- **Pago con Mercado Pago Checkout Pro**. Se requiere que el usuario entregue el Test Access Token y el webhook secret de su cuenta de Mercado Pago (Chile) para probar el flujo real. Sin esas credenciales el pago no se puede validar de punta a punta.
- **Sin cuentas de usuario**: identificación por dispositivo (no login). El admin se protege con una contraseña simple.
- **Precio inicial**: 3.990 CLP por historia (valor fijado en el servidor; se validará contra el monto real del pago).
- **Los 5 temas** disponibles desde el inicio.
- **Costo de IA**: se registra y se muestra en admin un costo estimado por historia (objetivo bajo 600 CLP); el guardrail es de monitoreo, no bloquea la generación.
- **Borrado a 7 días**: se marca la fecha de expiración de las fotos originales y se comunica al usuario; la limpieza efectiva corre como tarea de mantención.
- **Idioma**: toda la interfaz en español de Chile; sin otros idiomas en esta fase.
