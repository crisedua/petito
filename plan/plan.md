# Petito · El universo de mi mascota

Evolución de Petito desde "herramientas sueltas de IA" hacia un mundo emocional: cada mascota tiene su propio
universo con historia, personalidad, aventuras y una colección de recuerdos que crece con el tiempo.

## Para quién es
- Dueños de mascotas en Chile (español latino cálido) que quieren celebrar y preservar su relación con su mascota,
  no solo generar una imagen o un video.
- Usuarios actuales de Petito: todo lo que ya existe (Historia, Retrato, Retrato recuerdo, Petito Habla, Mis
  creaciones, Admin, pagos Mercado Pago, login Google) se conserva y se reorganiza dentro del nuevo universo,
  sin perder cuentas ni contenido.

## Qué se construye ahora (Fase 1 — MVP)
1. **Nueva portada emocional** (reemplaza la portada actual del video que habla).
   - Titular: "Su vida es parte de tu historia. Hagamos que sea inolvidable."
   - Subtítulo: "Convierte los momentos con tu mascota en historias, recuerdos, aventuras y pequeñas sorpresas
     llenas de cariño."
   - CTA principal: "Crea el universo de tu mascota" → pide iniciar sesión con Google y luego lleva al onboarding.
   - CTA secundario: "Descubre cómo funciona" → sección breve de cómo funciona (visible sin cuenta).
   - El gancho actual (subir foto → video al instante) se retira de la portada; el video que habla sigue
     existiendo, ahora dentro del universo como una de las experiencias.

2. **Login obligatorio para crear/entrar**: el onboarding y "Mi universo" requieren iniciar sesión con Google.
   La portada y "Descubre cómo funciona" son lo único accesible sin cuenta.

3. **Onboarding** (`/bienvenida`, ya con sesión iniciada), en pasos con animaciones suaves:
   - Paso 1 — Conoce a la mascota: nombre, tipo (perro/gato/otro), foto.
   - Paso 2 — Personalidad: opciones ("El regalón de la casa", "Un pequeño terremoto", "Dormilón profesional",
     "Aventurero de corazón", "Travieso pero irresistible", "Otro: describe su personalidad"). Permite varias y
     texto propio.
   - Paso 3 — Conexión emocional: un recuerdo favorito (opcional, se puede saltar).
   - Paso 4 — Revelación: una presentación corta y personalizada generada con IA (texto cálido con el nombre,
     tipo y personalidad reales de la mascota + su foto), revelada progresivamente. Cierra con "Esta es apenas la
     primera página de su historia." y CTA "Entrar al universo de [nombre]".
   - La mascota se crea asociada directamente a la cuenta del usuario que inició sesión.

4. **"Mi universo"** (home de la mascota, requiere sesión):
   - Foto principal de la mascota, mensaje de bienvenida personalizado, y accesos como invitaciones emocionales
     (no botones técnicos): "Imagina lo que [nombre] te diría", "Crea una aventura juntos", "Guarda un recuerdo
     especial", "Descubre a [nombre] en otro mundo".
   - Cada invitación abre la herramienta que YA existe: Petito Habla, Historia, Retrato, Retrato recuerdo.
   - Muestra la colección de creaciones de esa mascota y un espacio para próximas fechas (visible, se llena en
     fases siguientes).

5. **Multi-mascota desde la Fase 1**: una cuenta puede tener varias mascotas, cada una con su propio universo y
   un selector para cambiar entre ellas. Se puede repetir el onboarding para agregar otra.

6. **Revelación de primera historia personalizada**: la presentación del Paso 4 es contenido real generado con la
   IA ya integrada (no una maqueta estática).

7. **Enlace con herramientas existentes dentro del universo**: Historia, Retrato, Retrato recuerdo y Petito Habla
   quedan accesibles desde el universo y las creaciones se asocian a la mascota activa. "Mis creaciones" se
   mantiene y sigue mostrando todo el contenido previo del usuario.

### Qué NO se construye en la Fase 1 (queda para fases 2–3)
- Libro "Nuestra historia" (recuerdos reales con fotos/fechas/notas y narrativas con IA).
- "Momentos especiales" (cumpleaños, aniversarios de adopción, celebraciones).
- Experiencias recurrentes (semanal "Un pequeño momento juntos", mensual "Así fue nuestro mes").
- Petito Habla con escenarios predefinidos y mensaje editable.
- Suscripción Petito Plus.
- Sistema de pequeñas sorpresas emocionales.
- Compartir público de la mascota, exportar ZIP y URLs firmadas de medios.

## Compatibilidad con lo existente
- No se elimina ni duplica ninguna función actual; se reorganizan dentro del universo.
- Las cuentas y el contenido actuales siguen funcionando. Las historias/retratos/videos antiguos quedan en "Mis
  creaciones" sin mascota asignada; se podrán asociar a una mascota más adelante.
- Todas las rutas actuales (crear historia, retrato, retrato recuerdo, video que habla, pagar HD, admin) siguen
  operativas.
- El arreglo del límite de 20 MB por foto se mantiene.

## User flow (Fase 1)
1. Alguien entra a Petito → ve la nueva portada emocional (sin cuenta puede ver la portada y "Descubre cómo
   funciona").
2. Toca "Crea el universo de tu mascota" → se le pide iniciar sesión con Google.
3. Tras iniciar sesión, pasa al onboarding `/bienvenida`: nombre, tipo, foto, personalidad y un recuerdo
   opcional.
4. Recibe una revelación personalizada de su mascota (texto + foto, animado). La mascota queda asociada a su
   cuenta.
5. Toca "Entrar al universo de [nombre]" y llega a "Mi universo", donde accede a las experiencias (video que
   habla, historia, retrato, retrato recuerdo), ahora ligadas a esa mascota.
6. Puede agregar otra mascota y cambiar entre universos.
7. Todo lo existente (crear historia, retrato, pagar HD, etc.) sigue funcionando igual en sus mismas rutas.

## UI/UX feel
- Identidad cálida y emocional: fondos ivory/crema, acentos terracota, durazno y sage; tarjetas redondeadas
  elegantes, tipografía espaciosa tipo "álbum/storybook".
- Fotografía real de mascotas donde sea posible; evitar estética genérica de IA y look de dashboard SaaS.
- Transiciones suaves, microanimaciones y secuencias de revelación pulidas; mobile-first.
- Se respeta "reduced motion" para accesibilidad.
- El resto de la app conserva su estilo actual y convive con la nueva función sin romperla.
- La distinción entre recuerdos reales y contenido imaginado por IA debe ser clara (relevante desde ya en el
  texto del onboarding).

## Fases de implementación

**Fase 1 — Fundación emocional (se construye ahora)**
- Nueva portada, login obligatorio para crear/entrar, onboarding `/bienvenida`, revelación personalizada con IA.
- "Mi universo" (home de la mascota) con invitaciones emocionales que abren las herramientas existentes.
- Multi-mascota (crear/seleccionar/cambiar), mascota asociada a la cuenta, creaciones ligadas a la mascota.
- Compatibilidad total con cuentas y contenido actuales.

**Fase 2 — Recuerdos que perduran (siguiente)**
- Libro "Nuestra historia" (fotos, fechas, descripciones, notas; narrativas cálidas con IA, siempre marcando lo
  real vs lo imaginado).
- Organización del contenido guardado por mascota; gestión de perfil y personalidad.
- Petito Habla con escenarios predefinidos y mensaje editable (con tope de caracteres por el costo del video).

**Fase 3 — Razones para volver + privacidad/pagos (futuro)**
- Experiencias recurrentes: semanal "Un pequeño momento juntos", mensual "Así fue nuestro mes", y
  "Momentos especiales" (cumpleaños/aniversarios).
- Sistema de pequeñas sorpresas emocionales.
- Privacidad avanzada: compartir público de la mascota, exportar ZIP, URLs firmadas de medios con vencimiento.
- **Petito Plus (~US$3/mes) con renovación automática** vía Mercado Pago **Preapproval** (suscripción recurrente,
  separada del pago único actual de Checkout Pro). Incluye suscribir, webhook de renovaciones/cobros y cancelar;
  el acceso se habilita solo tras confirmar el estado real en Mercado Pago, no por el regreso del navegador.
  Requiere definir el monto en CLP (entero) y que la cuenta/aplicación tenga Suscripciones habilitadas; en
  producción se necesita `MERCADOPAGO_WEBHOOK_SECRET` y una URL pública HTTPS para el webhook.

## Assumptions
- El onboarding y "Mi universo" requieren iniciar sesión con Google; solo la portada y "Descubre cómo funciona"
  son accesibles sin cuenta. No hay creación de mascota anónima por dispositivo.
- El trabajo ocurre solo en el preview; no se toca producción (petito.pro) en este trabajo.
- La función se construye directamente en este workspace (no se importa desde GitHub, porque la plataforma no
  permite traer código desde GitHub en medio de un job).
- La revelación personalizada y los textos cálidos usan la IA ya integrada (Claude vía Universal Key); no se
  piden claves nuevas en la Fase 1.
- "Reemplazar el gancho de la portada" significa quitar el flujo de subida instantánea de video de la portada;
  el video que habla sigue existiendo dentro del universo y en sus rutas actuales.
- Multi-mascota desde la Fase 1; el onboarding se puede repetir para agregar mascotas.
- El contenido antiguo (sin mascota) permanece accesible en "Mis creaciones"; su asociación a una mascota es una
  mejora posterior, no obligatoria para que todo funcione.
- Privacidad por defecto: universos y contenido privados; compartir es explícito (el compartir público llega en
  fase 3).
- Las experiencias de pérdida/memorial se mantienen sensibles y opcionales (Retrato recuerdo ya existe); no son
  parte del flujo por defecto.
- La IA nunca inventa hechos reales de la mascota; el contenido imaginado se etiqueta como tal.
- Petito Plus se implementa en la Fase 3 como suscripción auto-renovable (Mercado Pago Preapproval); el monto
  exacto en CLP (equivalente a ~US$3) se fija en ese momento como variable y se actualiza manualmente si cambia
  el tipo de cambio.
