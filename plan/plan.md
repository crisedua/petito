# Petito · Retrato de realeza (vista previa gratis → descarga de pago)

Desde la portada, la persona elige entre crear una **Historia** (lo actual) o un **Retrato**: una pintura clásica de su mascota con atuendo de realeza y marco dorado. Ve el retrato **gratis** (en baja resolución y con marca de agua) y, si le gusta, lo **descarga limpio y en alta calidad por $2.990 CLP**.
Incluye **modo regalo** (dedicatoria + enlace de regalo) y un estilo de temporada: **Halloween ahora, Navidad después**.

## Para quién es
Dueños de mascotas en Chile que quieren una imagen especial y elegante de su regalón —para guardar, imprimir o **regalar**— y están dispuestos a pagar poco por una versión de calidad. La vista previa gratis baja la barrera: primero se enamoran del resultado y recién ahí pagan.

## Funcionalidad y experiencia
- **Elección en la portada**: dos caminos — "Crear historia" (lo que ya existe, intacto) y "Crear retrato" (lo nuevo).
- **Subir foto → la IA la mejora**: la persona sube **una foto** de su mascota; la IA la transforma en una pintura clásica al óleo (recrea pose, vestuario y fondo de retrato; no es un filtro simple).
- **Estilos a elegir**:
  - **Renacentista**: óleo clásico, telón oscuro, luz cálida, vestuario de época.
  - **Victoriano / aristócrata**: atuendo noble (capa, encaje, joyas), aire señorial.
  - **Halloween** (temporada, disponible ahora): mismo retrato clásico con temática de Halloween (velas, telarañas, tono gótico). *Navidad llega en la siguiente temporada.*
- **Marco dorado ornamentado**: el retrato se entrega dentro de un marco dorado tallado (como una pintura colgada), por ahora siempre.
- **Un retrato por vez**: se genera **una** pintura por intento; para otro, se vuelve a generar.
- **Vista previa gratis con promesa clara**: al terminar se muestra el **retrato real ya generado**, pero en **baja resolución y con marca de agua grande "Petito"**. Un mensaje directo acompaña: *"Así quedó tu mascota. Descárgala en alta calidad, sin marca de agua, por $2.990."*
- **Compartir gratis**: se puede **compartir una imagen** del retrato (lleva la marca "Petito"), ideal para mostrarlo y traer más gente.
- **Pago y descarga HD**: al pagar **$2.990 CLP con Mercado Pago**, se desbloquea la **descarga limpia (sin marca de agua) y en alta resolución**. La descarga se habilita solo cuando el pago queda confirmado por el servidor (no por volver del checkout).
- **Modo regalo**:
  - **Dedicatoria**: "Para: / De:" + un mensaje corto, que se muestra junto al retrato.
  - **Enlace de regalo**: una página linda estilo *"Tienes un regalo de Petito"* que el destinatario abre y ve el retrato dedicado.
  - *(Agendar/enviar en una fecha queda para más adelante.)*
- **Español chileno** e identidad Petito (naranja/crema, tipografía redondeada). El botón "Invitar amigos" sigue visible.

## User flow
1. La persona entra a Petito y elige **"Crear retrato"**.
2. Sube **una foto** de su mascota y (opcional) escribe su nombre.
3. Elige el estilo: **Renacentista**, **Victoriano/aristócrata** o **Halloween**.
4. (Opcional) Activa **modo regalo** y escribe "Para / De" y un mensaje.
5. Toca "Crear retrato" y ve una espera corta ("Pintando a tu mascota…").
6. Aparece el **retrato real con marca de agua** y la promesa de descarga HD por $2.990.
7. Puede **compartir la imagen** (con marca) gratis, o **pagar** para desbloquear.
8. Al confirmarse el pago, **descarga el retrato limpio en alta calidad**; si es regalo, obtiene el **enlace de regalo** para enviar.

## UI/UX feel
- Portada con dos tarjetas grandes y amables ("Historia" y "Retrato"), cada una con imagen de muestra y micro-animación; sin tapar el logo ni el botón de invitar.
- Flujo de retrato de pocos pasos (foto → estilo → regalo opcional → crear), coherente con el asistente de historias.
- Pantalla de resultado centrada en la pintura enmarcada con marca de agua, promesa clara y un botón de pago destacado ("Descargar en HD · $2.990").
- Página de regalo cálida y festiva para el destinatario ("Tienes un regalo de Petito 🎁" → revelar el retrato).
- Mensajes simples y cálidos, nada técnico.

## Fases de implementación
**Fase 1 — MVP (se construye ahora)**
- Selector en la portada: "Crear historia" vs "Crear retrato".
- Flujo de retrato: subir una foto, nombre opcional, elegir **Renacentista / Victoriano / Halloween**, con **marco dorado**.
- Generar **un** retrato real con la IA a partir de la foto.
- **Vista previa gratis**: retrato real en baja resolución + **marca de agua "Petito"**, con promesa de descarga.
- **Compartir imagen** gratis (con marca de agua).
- **Pago $2.990 CLP con Mercado Pago**; al confirmarse, **descarga limpia en alta resolución**.
- **Modo regalo**: dedicatoria (Para/De + mensaje) + **enlace de regalo** con página para el destinatario.

**Fase 2 — Más opciones (futuro)**
- **Navidad** y más estilos (rey/reina con corona, militar, etc.).
- Variaciones (2-3 opciones para elegir) y distintos marcos.
- Nombre en una placa dorada dentro del marco.
- **Agendar/enviar el regalo** en una fecha (ej. que llegue el día de Navidad).

**Fase 3 — Imprimir y escalar (futuro)**
- Pedido de **impresión física** (lienzo/póster) y formatos para enmarcar.
- Pruebas de precio y packs (historia + retrato).
- Métricas de conversión "retrato" vs "historia" y de regalo en el panel admin.

## Assumptions
- **Cobro con Mercado Pago (Chile, CLP), precio $2.990**, un pago por retrato. El desbloqueo de la descarga HD ocurre **solo tras confirmación del pago en el servidor** (el regreso del checkout no desbloquea por sí solo).
- Para construir y probar se usan **cuentas de prueba** de Mercado Pago (Chile). Para cobrar de verdad necesito que me entregues tu **Access Token de producción** y el **secreto del webhook** (los obtienes en tu panel de Mercado Pago → Tus integraciones → Producción / Webhooks). Hasta tener esas llaves, el cobro real no queda activo.
- La **vista previa gratis** muestra el **retrato real ya generado**, en baja resolución y con marca de agua grande **"Petito"**; la imagen para **compartir** también lleva la marca "Petito".
- Al **pagar** se entrega la versión **limpia (sin marca) y en alta resolución**.
- El retrato usa la **misma IA de imágenes** que ya ocupa Petito (fal.ai Nano Banana con la llave universal de Emergent); no se agregan integraciones de IA nuevas.
- La persona sube **una** foto exclusivamente para el retrato; la IA la transforma (sin edición manual).
- Se genera **un** retrato por intento (sin galería ni variaciones en Fase 1).
- **Marco dorado ornamentado siempre** en Fase 1; **Halloween** entra como **un estilo más** (no un selector de "ocasión" aparte); **Navidad** queda para la próxima temporada.
- El **modo regalo** en Fase 1 incluye **dedicatoria + enlace de regalo**; **no** incluye agendar por fecha todavía.
- El retrato es una **imagen vertical** tipo cuadro; el nombre/dedicatoria se muestran **en pantalla**, no incrustados en la imagen, para evitar problemas de texto.
- Sin música ni narración: el retrato es una imagen estática (la historia actual no cambia).
- Los retratos **no** aparecen en el panel de administración en Fase 1.
- Sin cuenta ni registro obligatorio; la foto, el retrato y el enlace de regalo se guardan en el almacenamiento durable que ya usa la app.
