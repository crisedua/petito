# Arreglo: "Petito Habla" falla en petito.pro (error de origen / Cloudflare 520)

Al subir la foto en "Sube una foto y mira la magia", petito.pro muestra un error de Cloudflare ("the origin
web server sent a response that Cloudflare could not parse"). Pasa solo en ese paso; el resto del sitio
navega bien. Es un fallo del servidor de producción al atender esa petición, no un error normal de la app.

## Para quién es
Cualquier persona que entra a petito.pro y prueba el gancho principal de la portada (el video de mascota
hablando, gratis y sin cuenta). Es el primer momento que convierte visitantes en usuarios y hoy está roto,
así que la prioridad es dejarlo funcionando de forma estable en producción.

## Qué está pasando (diagnóstico)
- El error es de Cloudflare "no pudo interpretar la respuesta del origen": significa que el backend de
  producción devolvió una respuesta vacía o inválida para esa petición puntual (típico de un tiempo de
  espera agotado, o de que el proceso se reinició/quedó sin memoria mientras atendía la petición).
- Ocurre solo al subir la foto en "Petito Habla"; la portada, Retrato, Historia y Recuerdo funcionan. Eso
  indica que el backend en general está sano y que el problema está acotado a este endpoint.
- "Petito Habla" es el único flujo cuyo adelanto dispara, en la misma petición, el pipeline más pesado de
  toda la app (análisis de imagen + generación de voz + generación de video con IA + procesamiento de
  imágenes). Esa carga es la sospecha principal de por qué solo este endpoint falla en producción.
- En el entorno de prueba el mismo adelanto funciona; la diferencia está en los límites de recursos y tiempo
  de espera de producción, que solo este endpoint supera.

## Qué se va a hacer (experiencia resultante)
- **Revisar el origen en producción** (registros/estado del proceso para esa petición) para confirmar la
  causa exacta: tiempo de espera agotado, falta de memoria/reinicio del proceso, o una respuesta mal formada.
  Esto requiere mirar el entorno de producción directamente, no solo el código.
- **Asegurar que el adelanto responda al instante**: la pantalla debe recibir de inmediato un "ok, estamos
  generando" y que todo el trabajo pesado (voz, video, imágenes) ocurra en segundo plano, sin que la
  respuesta al navegador dependa de ese trabajo. Si hoy algo bloquea esa respuesta en producción, se corrige.
- **Bajar el consumo del adelanto gratis** para que no tumbe el proceso: mantener la versión corta y de baja
  resolución que ya existe, liberar las imágenes grandes en memoria cuanto antes y poner límites de tiempo a
  las llamadas externas, de modo que el proceso de producción no se quede sin memoria ni se cuelgue.
- **Mensaje claro si algo falla**: en vez de la pantalla de error de Cloudflare, mostrar un aviso amable
  ("estamos con alta demanda, intenta de nuevo en un momento") y registrar la causa real para cerrarla.
- **Soporte de fotos de iPhone (HEIC/HEIF)** en todos los flujos de subida, como refuerzo.
- **Corregir el aviso de PWA deprecado** (`mobile-web-app-capable`); es cosmético de consola.

## User flow (después del arreglo)
1. La persona entra a petito.pro y toca "Sube una foto y mira la magia".
2. Elige una foto (computador o teléfono, incluidas fotos de iPhone).
3. La pantalla confirma al instante que empezó y muestra el progreso ("Dándole voz a tu mascota…").
4. El trabajo pesado corre en segundo plano y, al terminar, ve su mascota hablando (corto, con marca de agua).
5. Si hay un problema, ve un mensaje amable en pantalla (no la pantalla de error de Cloudflare) y puede
   reintentar.
6. Si ya usó sus adelantos gratis del día, ve el mensaje de límite e invitación a crear el video completo.

## UI/UX feel
- Igual que hoy: naranja/crema, tono cálido y chileno, nada técnico.
- Lo único que cambia es que ya no aparece la pantalla de error de Cloudflare; si algo falla, el mensaje es
  amable y dentro de la app.

## Fases de implementación
**Fase 1 — MVP (se construye ahora)**
- Revisar producción para confirmar la causa (timeout / memoria / respuesta inválida) de este endpoint.
- Garantizar que el adelanto responda de inmediato y que todo el pipeline pesado corra en segundo plano.
- Reducir el consumo del adelanto gratis (memoria y tiempo) para que no tumbe el proceso en producción.
- Mensaje de error amable en pantalla + registro de la causa real; soporte HEIC/HEIF; arreglo de la etiqueta PWA.
- Verificar un adelanto gratis completo, de punta a punta, en petito.pro.

**Fase 2 — Robustez (futuro)**
- Procesar la generación de video en un proceso/segundo plano separado del que atiende las peticiones, para
  que una generación pesada nunca afecte la respuesta al navegador.
- Reintentos automáticos y mejor manejo de alta demanda (cola) en los adelantos gratis.

**Fase 3 — Visibilidad (futuro)**
- Registro de fallos de generación y un indicador simple en el panel de administración para detectar a tiempo
  si un flujo vuelve a romperse en producción.

## Assumptions
- El backend de producción en general está sano; el problema está acotado al endpoint del adelanto de
  "Petito Habla".
- Confirmar y cerrar la causa requiere revisar el entorno de producción (registros/estado del proceso), no
  solo el código; esa revisión es parte de la Fase 1 al salir del modo plan.
- El adelanto gratis se mantiene corto y de baja resolución (como está hoy) y el modelo de IA de video no
  cambia; el límite gratis sigue en 2 por día por dispositivo (ajustable).
- El precio del video completo sigue en $2.990 CLP.
- "Arreglado" significa: un adelanto gratis se genera de principio a fin en petito.pro desde computador y
  iPhone, sin la pantalla de error de Cloudflare, y cualquier fallo futuro se muestra como un aviso amable.
- No se tocan Retrato, Historia ni Recuerdo salvo el soporte de HEIC, que los beneficia sin cambiar su flujo.
