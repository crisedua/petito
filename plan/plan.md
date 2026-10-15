# Petito · Fase 2 — "Nuestra historia": recuerdos reales que emocionan

El corazón emocional del universo: cada mascota tiene un álbum vivo de recuerdos reales (foto, fecha,
lo que pasó y lo que se sintió), creados como una experiencia cálida y conmovedora, no como un formulario.

## Para quién es
- Dueños de mascotas en Chile que quieren atesorar y revivir momentos reales con su mascota —no solo
  generar imágenes— y sentir algo cada vez que guardan o abren un recuerdo.
- Usuarios actuales del universo Petito (Fase 1): esto se suma dentro de "Mi universo", sin cambiar nada
  de lo que ya existe (onboarding, invitaciones, multi-mascota, Petito Habla, Retrato, Historia).

## Core features y experiencia (Fase 1 de este plan = lo que se construye ahora)

1. **Nuevo espacio "Nuestra historia"** dentro del universo de cada mascota: un álbum con línea de tiempo
   (del recuerdo más reciente al más antiguo) donde viven los recuerdos reales de esa mascota.

2. **Crear un recuerdo como experiencia emocional** (no un formulario frío). Al guardar, la persona pasa
   por un momento guiado y cálido:
   - Elige/sube una foto del momento (opcional pero muy invitada).
   - Un título corto ("Su primer día en casa").
   - Una fecha (opcional; si no la sabe, "hace un tiempo").
   - **La pregunta que importa**: un campo que invita a sentir, no a describir —p. ej. "¿Qué sentiste ese
     día?"— con microcopys tiernos que cambian para animar a escribir desde la emoción.
   - **Cómo se sintió**: una fila de "emociones" cálidas para elegir (ternura, risa, alegría, orgullo,
     nostalgia, amor, calma…) que dan tono y color al recuerdo.
   - Al guardar, una **revelación suave**: animación tierna + mensaje tipo "Guardado para siempre 🤍" y el
     recuerdo aparece en el álbum con una presentación bonita.

3. **Reflexión cálida opcional escrita por Petito (IA), SIEMPRE marcada**: tras guardar, se ofrece (no se
   impone) una breve reflexión emotiva generada con IA a partir de lo que la persona escribió y la foto.
   Se muestra claramente como un pensamiento/sentir ("Un pensamiento de Petito 💭"), nunca como un hecho
   real, y la IA no inventa datos: solo acompaña la emoción de lo que el dueño ya contó. Se puede ocultar.

4. **Abrir un recuerdo**: una vista a pantalla completa, cálida y despejada, con la foto grande, el título,
   la fecha, lo que se sintió (emociones), el texto del dueño y —si existe— la reflexión de Petito marcada.
   Desde ahí se puede editar o borrar el recuerdo.

5. **La distinción real vs imaginado es clara en todo momento**: los recuerdos reales se ven como "lo que
   de verdad pasó"; cualquier texto de IA va etiquetado como sentir/acompañamiento, separado visualmente.

6. **Integrado al universo**: la invitación "Guarda un recuerdo especial" en "Mi universo" abre este
   espacio; la colección de la mascota y el álbum conviven; cada recuerdo pertenece a la mascota activa.

### Qué NO entra en la Fase 1 de este plan
- Petito Habla con escenarios predefinidos y mensaje editable (va en la Fase 2 de este plan).
- Gestión/edición del perfil y personalidad de la mascota (Fase 2 de este plan).
- Fechas especiales/recordatorios, experiencias recurrentes, sorpresas (Fase 3).
- Compartir público de la mascota, exportar ZIP, URLs firmadas (Fase 3).
- Petito Plus / suscripción (Fase 3).

## User flow
1. En "Mi universo" la persona toca "Guarda un recuerdo especial" (o entra a "Nuestra historia").
2. Ve el álbum de esa mascota; si está vacío, una invitación cálida a crear el primero.
3. Toca "Añadir recuerdo" y vive el momento guiado: foto → título → fecha → "¿qué sentiste?" → emociones.
4. Al guardar, ve la revelación tierna y el recuerdo ya en su álbum.
5. Se le ofrece la reflexión de Petito (IA, marcada); la acepta o la omite.
6. Puede abrir cualquier recuerdo para revivirlo, editarlo o borrarlo.
7. Cambia de mascota y ve el álbum propio de cada una (multi-mascota de la Fase 1).

## UI/UX feel
- Continúa la identidad cálida del universo: ivory/crema, acentos terracota/durazno/sage, tarjetas
  redondeadas tipo álbum, tipografía espaciosa; fotografía real protagonista.
- El acto de crear un recuerdo se siente íntimo: microcopys emotivos, ritmo pausado, una sola cosa a la
  vez, y una recompensa emocional al guardar (animación suave + "para siempre").
- Línea de tiempo legible y nostálgica; cada recuerdo como una página del álbum.
- Lo escrito por IA siempre se ve distinto y etiquetado, para no confundir con lo real.
- Mobile-first; se respeta "reduced motion".

## Fases de implementación

**Fase 1 — Nuestra historia (se construye ahora)**
- Álbum/timeline de recuerdos reales por mascota, creación como experiencia emocional guiada (foto, título,
  fecha, "qué sentiste", emociones), revelación al guardar, vista de recuerdo, editar/borrar, y reflexión
  cálida opcional de Petito (IA) siempre marcada. Integrado a "Mi universo" y multi-mascota.

**Fase 2 — Expresar y cuidar el vínculo (siguiente)**
- Petito Habla con escenarios predefinidos (p. ej. "feliz cumpleaños", "te extraño") y mensaje editable por
  el dueño, con tope de caracteres por el costo del video.
- Gestión del perfil y personalidad de la mascota; organización del contenido guardado.

**Fase 3 — Razones para volver + privacidad/pagos (futuro)**
- Fechas especiales (cumpleaños/aniversario de adopción) con recordatorios cálidos; experiencias recurrentes
  (semanal/mensual) y sorpresas emocionales.
- Compartir público de la mascota, exportar ZIP y URLs firmadas de medios.
- Petito Plus (~US$3/mes) con renovación automática vía Mercado Pago (Preapproval).

## Assumptions
- "Fase 2" se interpreta priorizando primero el **Libro "Nuestra historia"** (recuerdos reales), porque es
  donde la emoción es más central; Petito Habla con escenarios queda como la siguiente fase de este plan.
- La foto es opcional pero fuertemente invitada; un recuerdo puede guardarse solo con texto y/o emociones.
- La fecha es opcional (se permite "no la sé").
- La **reflexión de IA es opcional y siempre etiquetada** como sentir/acompañamiento ("Un pensamiento de
  Petito"), nunca como hecho real; la IA solo se apoya en lo que el dueño escribió y no inventa datos.
- Las "emociones" son un set curado y cálido (ternura, risa, alegría, orgullo, nostalgia, amor, calma, u
  otras similares), elegibles de a varias.
- Crear/ver/editar/borrar recuerdos requiere sesión iniciada (como el resto del universo); los recuerdos son
  privados por defecto (compartir llega en la Fase 3).
- Cada recuerdo pertenece a una mascota; al cambiar de mascota se ve su propio álbum.
- Se mantiene el límite de 20 MB por foto ya existente.
- El trabajo ocurre solo en el preview; no se toca producción (petito.pro) en este trabajo. (El arreglo del
  520 en vivo —subir tier y re-publicar— sigue pendiente como acción del dueño, aparte de este plan.)
