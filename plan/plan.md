# Petito · "Petito Habla": el video de tu mascota hablando

Un gancho que detiene el scroll: subes una foto y tu mascota cobra vida en un video
vertical corto, hablando con su propia voz una frase chistosa (humor chileno). Se ve
gratis al toque (sin cuenta) y, si te encanta, lo creas completo, lo descargas en alta
calidad y lo compartes.

## Para quién es
Dueños de mascotas en Chile que aman mostrar a su regalón y compartir cosas divertidas.
Es contenido hecho para reenviar por WhatsApp e historias: un perro o gato "hablando"
es irresistible y muy compartible, así que cada video trae más dueños nuevos a Petito.
También suma una tercera forma de crear (junto a Historia y Retrato) con su propio cobro.

## Core features and experience
- **Adelanto mágico GRATIS sin cuenta (en la portada)**: la portada muestra, como gran
  protagonista, un video de muestra de una mascota hablando. Un botón grande invita:
  "Sube una foto y mira la magia". Sin registrarse, la persona sube una foto y en unos
  segundos ve a su mascota hablar en un **video corto (~5s), en baja resolución y con
  marca de agua "Petito"**, con una frase chistosa generada por IA y una voz simpática.
- **Frase con humor chileno automática**: la IA inventa la línea según la mascota (nombre,
  si es perro/gato) con el tono juguetón de Petito. La persona no tiene que escribir nada.
- **Crear el video completo (requiere iniciar sesión)**: si le gustó el adelanto, inicia
  sesión para crear la versión completa: elige la **voz** (las voces en español que ya
  ofrece Petito) y genera un **video vertical de ~8s**. Ve una **vista previa gratis con
  marca de agua**; para **descargar en alta calidad, sin marca y compartir** paga
  **$2.990 CLP** (mismo cobro que el retrato, vía Mercado Pago).
- **Hecho para compartir**: botón directo a WhatsApp y enlace público del video (como los
  enlaces de retrato/historia), que cualquiera abre sin cuenta. El video gratis/preview
  siempre lleva la marca "Petito" para que corra la voz.
- **Tercera tarjeta en la portada**: junto a "Crear historia" y "Crear retrato" aparece
  "Hacer que hable", de modo que sea una creación más que queda guardada en "Mis creaciones".
- **Todo ligado a la cuenta**: los videos creados y su estado de pago quedan en la cuenta,
  visibles en "Mis creaciones" (nueva pestaña de videos), recuperables desde otro teléfono.

## User flow
1. La persona entra a Petito y la portada le muestra, de inmediato, una mascota hablando.
2. Toca "Sube una foto y mira la magia" y elige una foto (sin iniciar sesión).
3. Espera unos segundos ("Dándole voz a tu mascota…") y ve el **adelanto gratis**: su
   mascota hablando, corto y con marca de agua.
4. Si le encanta, toca "Crear el mío completo" → se le pide **iniciar sesión con Google**.
5. Ya conectada, elige la voz y genera el **video completo**; ve la vista previa con marca.
6. Comparte el adelanto gratis cuando quiera, o paga **$2.990** para **descargar en alta
   calidad y sin marca** y obtener el enlace para compartir.
7. Desde "Mis creaciones" puede volver a ver, descargar o compartir sus videos.

## UI/UX feel
- Coherente con Petito: naranja/crema, tipografía redondeada, tono cálido y chileno.
- **Portada rediseñada con impacto**: el video de muestra (en loop, formato teléfono)
  como héroe, titular corto y pegajoso, y el botón de adelanto gratis como protagonista;
  debajo, las tres tarjetas de creación. El botón "Invitar amigos" y el perfil siguen visibles.
- Pantalla de generación entretenida ("Dándole voz a tu mascota…") para que la espera del
  video se sienta parte de la magia.
- Resultado centrado en el video, con reproducción automática en silencio y toque para oír,
  botones grandes de compartir y de "Descargar en HD · $2.990".
- Mensajes simples, divertidos y nada técnicos.

## Implementation phases

**Fase 1 — MVP (se construye ahora)**
- Portada rediseñada con video héroe y el **adelanto mágico gratis sin cuenta** (subir foto
  → video corto, baja resolución, con marca de agua, frase IA + voz).
- Tercera tarjeta "Hacer que hable" y flujo completo **con login**: elegir voz, generar
  video vertical ~8s, **vista previa con marca gratis**, **pago $2.990** para descargar en
  alta calidad/sin marca y compartir (Mercado Pago, como el retrato).
- Enlace público para compartir el video; nueva pestaña de **videos en "Mis creaciones"**.
- Frase chistosa **automática por IA** (humor chileno) según la mascota.

**Fase 2 — Más magia (futuro)**
- "Haz que tu **retrato de realeza** hable": animar un retrato ya creado (no solo la foto).
- Que el dueño pueda **escribir su propia frase** además de la IA; más voces y acentos.
- Videos más largos, fondos/temáticas (ej. Halloween, Navidad), y música de fondo.
- Plantillas de ocasión ("feliz cumple", "te extraño") listas para regalar.

**Fase 3 — Escalar (futuro)**
- Packs y precios combinados (retrato + video), pruebas de precio.
- Export optimizado para TikTok/Reels/Stories y marca de agua con usuario.
- Métricas de conversión del adelanto gratis → pago en el panel admin.

## Assumptions
- El "wow" principal es un **video de mascota hablando** generado con IA de video de fal.ai
  (vía la llave universal de Emergent que ya usa Petito; p. ej. un modelo de avatar/lip-sync
  tipo Hedra Character-3, confirmado al construir). La voz usa la integración **ElevenLabs**
  ya existente; la frase la escribe la IA de texto que ya usa Petito.
- Importante sobre la voz hablada en mascotas: el resultado es un efecto divertido y
  expresivo, no un calce de labios perfecto (son animales); el valor es lo entretenido y
  compartible, no el realismo.
- El **adelanto gratis sin cuenta**: video **corto (~5s), baja resolución, con marca de agua
  "Petito"**, una voz por defecto y frase IA. Para controlar costos, habrá un **límite diario
  por dispositivo** (ej. 1–2 adelantos). Crear el video completo exige **iniciar sesión**.
- La **versión completa**: ~8s, vertical, vista previa con marca gratis; **descarga HD sin
  marca + compartir** se desbloquean al pagar **$2.990 CLP** (mismo precio y flujo que el
  retrato, confirmación por servidor; ajustable luego). El estado de pago queda en la cuenta.
- La entrada en Fase 1 es **una foto** subida por la persona (animar un retrato existente
  queda para Fase 2). Se genera **un** video por intento.
- La IA elige la frase (humor chileno) automáticamente; el dueño no escribe texto en Fase 1.
- Los videos y adelantos usan el almacenamiento durable que ya ocupa la app; la foto se borra
  según la retención actual (~7 días). Los enlaces compartidos se abren **sin** cuenta.
- La generación de video consume crédito de la llave universal (es más costosa que una imagen)
  y toma más tiempo que un retrato; la espera se muestra como parte de la experiencia.
- **No** se incluye el "Muro de la realeza". El cobro del retrato ($2.990) y el resto de la
  app siguen igual; esto se suma como una creación nueva.
