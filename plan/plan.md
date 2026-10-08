# Petito · Que la voz (y la música) se escuchen al reproducir

La historia debe sonar: la narración de la mascota y la musiquita de fondo tienen que escucharse al ver la historia, tanto en el sitio publicado como en los enlaces compartidos.
Hoy no se escucha nada porque los navegadores bloquean el audio automático hasta que la persona toca la pantalla, y la app no está pidiendo ese toque ni arrancando el sonido con él.

## Por qué pasa (diagnóstico)
- En el reporte: no se escucha NI música ni voz, y la persona no tocó la pantalla. La música se genera en el propio navegador (no depende del servidor), así que si tampoco suena, la causa no es el servidor ni el almacenamiento: es la regla de "no autoplay con sonido" de los navegadores (Safari de iPhone y los de computador la aplican estricto).
- La app intenta sonar sola; el navegador lo bloquea; y no hay un botón visible que diga "toca para escuchar", por lo que queda en silencio.

## Para quién es
Dueños de mascotas en Chile que abren su historia (recién creada o por un enlace compartido) y esperan verla y ESCUCHARLA: la voz de su regalón narrando y la música de fondo.

## Funcionalidad y experiencia
- **Arranque con sonido al primer toque**: al abrir la historia aparece un llamado claro (ej. un botón grande "▶ Tocar para reproducir con sonido"). Con ese toque empieza todo: música + voz, desde la primera diapositiva.
- **Un solo toque despierta ambos audios**: ese mismo gesto activa la música y la narración juntas (es lo que el navegador exige); de ahí en adelante todo fluye solo.
- **No se pierde el inicio**: la historia no avanza sola hasta que la persona toca para empezar, así nadie se pierde la primera frase.
- **Respeta las preferencias**: si antes dejó la narración o la música en silencio, se respeta; los botones de silenciar/activar voz y música siguen funcionando igual.
- **Funciona en el enlace compartido**: quien abre el enlace ve el mismo llamado y, al tocar, escucha la narración y la música.
- **iPhone y computador**: el arranque por toque está pensado para que funcione en Safari de iPhone (el más estricto) y en navegadores de computador.
- **Si el sonido quedó apagado**: mientras suena, si por alguna razón el navegador silencia, se muestra un pequeño botón "Activar sonido" para reactivarlo con un toque.

## Flujo de uso
1. La persona abre su historia (al crearla o por un enlace).
2. Ve la primera diapositiva con un llamado claro para tocar y escuchar.
3. Toca una vez: empiezan la música y la voz desde el inicio.
4. La historia avanza sola, esperando a que cada frase termine de leerse; puede silenciar/activar voz o música, o repetir la frase.

## Sensación de UI/UX
- Coherente con Petito (naranja/crema, tipografía redondeada, tono chileno).
- El llamado a tocar es amable y evidente, sin tapar la foto: un botón/affordance centrado con micro-animación ("▶ Tocar para reproducir con sonido").
- Una vez iniciado, el botón desaparece y quedan los controles normales (voz, repetir, música, play) abajo a la derecha.
- Nada de textos técnicos ni mensajes de error; solo una invitación simple a tocar.

## Fases de implementación
**Fase 1 — MVP (se construye ahora)**
- Detectar que el navegador bloquea el audio automático y mostrar el llamado "Tocar para reproducir con sonido".
- Con el primer toque, iniciar música + narración juntas desde la primera diapositiva, de forma confiable en iPhone (Safari) y computador.
- No auto-avanzar hasta que la persona inicie; respetar las preferencias de silencio ya guardadas.
- Mismo comportamiento en la vista recién creada y en el enlace compartido.
- Botón "Activar sonido" de respaldo si el audio queda silenciado.

**Fase 2 — Comodidad (futuro)**
- Recordar que la persona ya "activó el sonido" para que la próxima vez arranque con el mínimo roce posible.
- Indicador sutil de que la voz está hablando (ondas/el ícono animado) y resaltado de la frase que se lee.

**Fase 3 — Alcance (futuro)**
- Botón directo "Compartir con sonido" y, más adelante, exportar un video vertical con voz + música (que ya trae el audio incrustado y evita el tema del autoplay en redes).

## Supuestos
- La causa es la política de autoplay del navegador (no un problema del servidor ni del almacenamiento de audio), porque tampoco suena la música, que es 100% del lado del navegador.
- El arreglo es solo de experiencia en el reproductor: se agrega el arranque por toque; no cambian las voces, los textos, ni la generación de la historia.
- Se elige pedir UN toque para iniciar con sonido (lo más confiable en todos los navegadores) en vez de reproducir en silencio y pedir "activar sonido" después; igual se deja el botón de "Activar sonido" como respaldo.
- La narración sigue activada por defecto y la música también; las preferencias de silencio por separado se mantienen.
- Aplica tanto a la historia recién creada como a los enlaces compartidos; no aparece en el panel de administración.
- Todo el texto en español chileno.
