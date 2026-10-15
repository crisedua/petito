# Traer "El universo de mi mascota" desde GitHub y dejarlo funcionando en el preview

Sincronizar el workspace de Emergent con la rama `main` de GitHub (commit "El universo de mi mascota"),
trayendo la nueva función completa, y dejarla funcionando y verificada en el preview con los servicios reales.

## Para quién es
El dueño del proyecto Petito, que construyó la función "universo" fuera de Emergent (en GitHub) y necesita
que ese código vuelva al workspace para seguir trabajando y, más adelante, publicarlo. Y los usuarios
finales de Petito (dueños de mascotas en Chile), que pasarán de usar herramientas sueltas a tener un
"universo" emocional por cada mascota, sin perder nada de lo que ya existía.

## Qué se trae (resultado)
GitHub `main` está 2 commits adelante y 0 atrás de lo último que había en Emergent: es un superconjunto
limpio. Se trae toda la función nueva, que se suma a lo existente (Petito Habla, Retrato, Retrato recuerdo,
Historia, Mis creaciones, Admin, pagos Mercado Pago, login Google) sin quitar nada:

- **Universo por mascota**: cada mascota tiene su espacio (Mi universo, Nuestra historia, Aventuras,
  Momentos especiales, Creaciones, Perfil).
- **Onboarding sin cuenta** (`/bienvenida`) con una presentación personalizada; la mascota se "reclama" al
  entrar con Google.
- **Libro de recuerdos reales** vs **contenido imaginado** (aventuras, resúmenes, celebraciones), siempre
  etiquetados; la IA nunca inventa hechos reales.
- **Petito Habla con escenarios** y mensaje editable por el dueño (tope de 160 caracteres por costo de video).
- **Privacidad**: medios de mascota por URL firmada con vencimiento, compartir explícito (`/u/:slug`),
  exportar ZIP, borrar recuerdo o mascota.
- **Petito Plus**: pase de 30 días vía Mercado Pago (no se renueva solo), con límites Gratis/Plus
  configurables por variables de entorno.
- **Fechas especiales** calculadas en el día local del dueño.

## Qué se conserva del workspace (no viene de GitHub)
- Los archivos de entorno protegidos quedan intactos: `backend/.env`, `frontend/.env`, con `MONGO_URL`,
  `DB_NAME` y `REACT_APP_BACKEND_URL` sin cambios (no están en el repo).
- El **límite de 20 MB por foto** (parte del arreglo del error 520) se re-aplica encima, porque quedó solo
  en el workspace y no llegó a GitHub.

## Cómo queda la experiencia (user flow)
1. Alguien entra a Petito por primera vez y pasa por `/bienvenida`: responde unos pasos y recibe una
   presentación personalizada de su mascota, sin tener que crear cuenta.
2. Al entrar con Google, esa mascota queda reclamada y asociada a su cuenta.
3. Desde "Mi universo" ve la portada de su mascota y accede a: guardar recuerdos reales, crear aventuras
   imaginadas, celebrar fechas, y usar las herramientas existentes (Retrato, Historia, Petito Habla) ahora
   ligadas a esa mascota.
4. Puede compartir una página pública de su mascota (solo lo que marque), exportar todo en ZIP, o borrar.
5. Si llega a los límites del plan Gratis, se le ofrece Petito Plus (pase de 30 días por Mercado Pago).
6. Todo lo anterior ya existente (crear historia, retrato, retrato recuerdo, video que habla, pagar HD)
   sigue funcionando igual, en sus mismas rutas.

## UI/UX feel
- Lo define el código que ya viene de GitHub: un sistema visual cálido nuevo (paleta ivory/cream/terracotta/
  sage, tipografía tipo "story"/serif), pensado como un álbum emocional, con animaciones suaves.
- Se respeta `reduced motion` para quien lo prefiera.
- El resto de la app mantiene su estilo actual; la función nueva convive sin romper lo anterior.

## Fases de implementación

**Fase 1 — Traer el código y dejarlo funcionando en preview (se hace ahora)**
- Sincronizar el workspace con GitHub `main`: traer todos los archivos nuevos y modificados de la función
  "universo" (backend y frontend), conservando los `.env` protegidos y re-aplicando el límite de 20 MB.
- Instalar cualquier dependencia nueva que la función requiera y levantar los servicios.
- Conectar los servicios reales (Claude, almacenamiento de objetos, Mercado Pago) en lugar de los mocks con
  que se probó originalmente, usando la configuración ya presente en el workspace.
- Verificar de punta a punta en el preview los flujos principales: onboarding y reclamo de mascota al entrar
  con Google, crear/editar/borrar recuerdos, generar aventuras y celebraciones (IA real), Petito Habla con
  escenario y mensaje editable, página compartida, exportar ZIP, y que lo existente (Historia, Retrato,
  Retrato recuerdo, pagos) siga funcionando.
- Corregir lo que aparezca al pasar de mocks a servicios reales hasta que los flujos queden funcionando.

**Fase 2 — Pagos y privacidad con servicios reales (siguiente)**
- Verificar el pase Petito Plus con el checkout y webhook reales de Mercado Pago (activación del pase de 30
  días y expiración).
- Afinar las URLs firmadas de medios y el flujo de compartir/exportar con datos reales.

**Fase 3 — Producción (futuro)**
- Para dejar todo en vivo en petito.pro: aplicar lo pendiente del arreglo 520 (subir el tier de memoria y
  re-publicar) y configurar `MEDIA_SIGNING_SECRET` para las URLs firmadas de medios.
- Pendientes que ya trae el propio plan del universo: resumen del mes en video y renovación automática del
  pase (Mercado Pago Preapproval).

## Assumptions
- "Sincronizar a GitHub `main`" significa dejar el código de la app igual a ese commit; los archivos de
  entorno (`.env`) y el límite de 20 MB por foto son las únicas excepciones que se conservan del workspace.
- La base de datos del preview es aditiva: las colecciones nuevas (`pets`, `memories`, `tales`, etc.) se
  crean solas; las historias/retratos/videos antiguos quedan sin mascota asignada y se pueden asociar luego.
- Las claves/variables nuevas con valores por defecto seguros (límites de plan, precio de Plus, firma de
  medios) funcionan en preview sin configuración adicional; `MEDIA_SIGNING_SECRET` real queda para producción.
- No se toca producción (petito.pro) en este trabajo; esto ocurre solo en el preview.
- Las credenciales ya presentes en el workspace (Claude/Universal Key, almacenamiento de objetos, token de
  Mercado Pago, login Google) son las que se usan para la verificación real; no se piden claves nuevas.
- Si algún flujo de la función "universo" no fue diseñado para los servicios reales y no se puede dejar
  funcionando sin un cambio de alcance mayor, se informa en vez de asumir un rediseño.
