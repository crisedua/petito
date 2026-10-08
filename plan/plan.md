# Petito · Encuesta "¿Pagarías $9.900 al año?"

Una encuesta de una pregunta que mide si la gente pagaría por la app. Aparece una sola vez al ver una historia (propia o compartida), guarda la respuesta en la base de datos y muestra los resultados en el panel de administración.

## Para quién es
- Dueños de mascotas que ya vieron una historia: se les hace una pregunta rápida de disposición a pagar.
- El dueño del negocio (admin): ve cuántos responderían Sí/No para decidir el precio y si activar el cobro.

## Funcionalidad y experiencia
- **Una sola pregunta**: "¿Pagarías $9.900 al año por esta app?" con dos botones: **Sí** y **No**.
- **Dónde aparece**: en la pantalla de resultado (después de ver la historia recién creada) y también en los enlaces compartidos, para que opine tanto quien la crea como quien la abre.
- **Una vez por persona**: si ya respondió, no se le vuelve a mostrar (ni en esta ni en otras historias desde el mismo dispositivo/navegador). Queda la opción de cerrarla ("Ahora no") sin responder; en ese caso podría volver a aparecer más adelante.
- **Agradecimiento breve**: al responder, un mensaje corto ("¡Gracias por tu opinión! 🐾") y la encuesta desaparece.
- **Guardado en base de datos**: cada respuesta se guarda (Sí/No, fecha, y a qué historia pertenecía) asociada al dispositivo para no contar doble.
- **Resultados en el panel admin**: una tarjeta nueva con el total de respuestas, cuántos Sí y cuántos No, y el porcentaje que diría que Sí.
- **Texto en español chileno**, coherente con la marca Petito (naranja/crema, tipografía redondeada).

## User flow
1. La persona ve su historia (recién creada o por un enlace compartido).
2. Aparece la encuesta con la pregunta y los botones Sí / No (y un "Ahora no" para cerrarla).
3. Toca Sí o No → se guarda la respuesta y se muestra el agradecimiento.
4. No se le vuelve a mostrar la encuesta.
5. El admin entra a su panel y ve el resumen de respuestas (Sí/No y %).

## UI/UX feel
- Tarjeta/afiche compacto y amable debajo de la historia (no tapa el carrusel ni los botones de compartir/descargar).
- Dos botones claros (Sí / No) con micro-animación al tocar; un enlace discreto "Ahora no".
- Transición suave al estado de agradecimiento.
- En el panel admin, una tarjeta simple con números grandes y una barra o porcentaje.

## Fases de implementación
**Fase 1 — MVP (se construye ahora)**
- Encuesta de una pregunta (Sí/No) en la pantalla de resultado y en los enlaces compartidos.
- Mostrar una sola vez por persona (recordado por dispositivo/navegador); opción "Ahora no".
- Guardar cada respuesta en la base de datos (respuesta, historia, dispositivo, fecha).
- Tarjeta de resultados en el panel de administración (total, Sí, No, % Sí).

**Fase 2 — Más contexto (futuro)**
- Pregunta de seguimiento opcional al responder (p. ej. "¿Cuánto pagarías?" o un comentario libre).
- Filtrar resultados por fecha o por tema de la historia en el panel admin.

**Fase 3 — Precio y segmentación (futuro)**
- Probar distintos precios (A/B) y comparar la tasa de "Sí" por precio.
- Exportar resultados (CSV) y cruzarlos con cuántas historias creó cada persona.

## Assumptions
- La pregunta y el precio son exactamente: "¿Pagarías $9.900 al año por esta app?" (Sí/No), sin campos adicionales en la Fase 1.
- Aparece tanto en la vista recién creada como en los enlaces compartidos; NO aparece en el panel de administración.
- Se muestra una vez por persona usando el identificador de dispositivo/navegador ya existente; "Ahora no" cierra sin responder y permite que reaparezca luego.
- La respuesta se asocia al dispositivo y a la historia donde se respondió; es anónima (no pide nombre ni correo).
- Los resultados del panel admin quedan detrás del acceso de administrador ya existente.
- La encuesta no bloquea ni interrumpe la reproducción de la historia; es un elemento aparte, debajo.
- Todo el texto en español chileno y con la identidad visual de Petito.
