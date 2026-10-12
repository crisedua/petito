# Petito · Cuentas con Google y "Mis creaciones"

Petito pasa de funcionar sin cuenta a pedir inicio de sesión con Google antes de crear.
Cada persona tiene su cuenta, con sus historias y retratos guardados y recuperables desde cualquier teléfono.

## Para quién es
Dueños de mascotas en Chile que crean historias y retratos de su regalón y quieren volver a verlos,
descargarlos o compartirlos más tarde —desde el mismo teléfono u otro— sin perder lo que ya hicieron
ni lo que ya pagaron. También para el administrador (tú), que entra con tu propio Google en vez de una contraseña.

## Funcionalidad y experiencia
- **Entrar con Google**: un botón "Entrar con Google" en español. Sin contraseñas que recordar; el inicio
  de sesión dura varios días, así que no hay que reingresar en cada visita.
- **Login obligatorio para crear**: para empezar una historia o un retrato, primero hay que iniciar sesión.
  Ver una historia o un retrato **compartido** (los enlaces que mandas a otros, incluido el enlace de regalo)
  **no** exige cuenta: cualquiera puede abrirlo.
- **"Mis creaciones"**: una sección propia donde la persona ve **Mis historias** y **Mis retratos**, con una
  miniatura de cada uno y acceso rápido para abrirlos, descargarlos o compartirlos otra vez.
- **Todo queda ligado a la cuenta**: las historias y retratos que creó, y también el **estado de pago**
  (si ya desbloqueó un retrato en alta calidad, al volver a entrar lo ve desbloqueado, aunque sea en otro
  teléfono).
- **Perfil simple**: muestra el nombre y la foto de Google de la persona, y un botón para cerrar sesión.
- **Admin con Google**: el Panel de administración deja de usar la contraseña actual. Entra solo una lista
  de correos autorizados; en esta primera versión, **eduardo@eduescalante.com**. Cualquier otro correo que
  intente entrar al panel ve un mensaje de "no autorizado".

## User flow
1. La persona abre Petito y, en la portada, toca "Crear historia" o "Crear retrato".
2. Si no ha iniciado sesión, aparece una pantalla de bienvenida con "Entrar con Google".
3. Elige su cuenta de Google y vuelve a Petito ya conectada, justo donde iba (crear historia o retrato).
4. Crea su historia/retrato como hoy; al terminar, queda guardado en su cuenta.
5. Desde la portada puede abrir **"Mis creaciones"** y ver todas sus historias y retratos, con su estado de
   pago, para reabrir, descargar o volver a compartir.
6. El dueño puede **cerrar sesión** desde su perfil cuando quiera.
7. Para el admin: entra a `/admin`, inicia con Google; si su correo está autorizado, ve el panel; si no, ve "no autorizado".

## UI/UX feel
- Coherente con Petito: naranja/crema, tipografía redondeada, tono cálido y chileno.
- Pantalla de login amable, con el logo y una frase breve; el botón "Entrar con Google" es el protagonista.
- "Mis creaciones" como una galería simple de tarjetas (historia/retrato) con miniatura y estado.
- El botón "Invitar amigos" sigue visible; se suma el acceso a "Mis creaciones" y al perfil.
- Mensajes simples y cálidos, nada técnico.

## Fases de implementación
**Fase 1 — MVP (se construye ahora)**
- Inicio de sesión con Google (botón "Entrar con Google", sesión que se mantiene varios días, cerrar sesión).
- Login **obligatorio** antes de crear una historia o un retrato.
- Historias y retratos quedan ligados a la cuenta, incluido el **estado de pago**.
- Sección **"Mis creaciones"** con "Mis historias" y "Mis retratos".
- Enlaces compartidos y de regalo siguen abriéndose **sin** cuenta.
- Admin por **lista de correos Google autorizados** (eduardo@eduescalante.com), reemplazando la contraseña.

**Fase 2 — Más cuenta (futuro)**
- Borrar o renombrar creaciones desde "Mis creaciones"; marcar favoritos.
- Más administradores y roles (ej. solo-lectura).
- Recordatorios por correo (ej. "tu retrato te espera", novedades de temporada).

**Fase 3 — Escalar (futuro)**
- Historial de compras y recibos en la cuenta.
- Vincular creaciones hechas antes sin cuenta mediante el enlace/código.
- Más proveedores de inicio de sesión si se necesitan.

## Assumptions
- Se usa el inicio de sesión con Google gestionado por Emergent (sin que tengas que configurar llaves de Google).
  La persona siempre vuelve al dominio desde el que entró.
- **Crear** exige sesión; **ver** un enlace compartido o de regalo (historia o retrato) **no** la exige.
- La sesión dura ~7 días; luego se vuelve a entrar con Google (un toque, sin contraseña).
- Las historias y retratos **creados antes** de esta actualización (con el ID de dispositivo anterior) **no**
  se migran automáticamente a ninguna cuenta: seguirán accesibles por su enlace, pero no aparecerán en
  "Mis creaciones" de nadie. Lo nuevo sí queda ligado a la cuenta.
- El Panel de administración pasa a Google con lista de correos autorizados; **se elimina** la contraseña
  actual como forma de entrar. En Fase 1 el único correo autorizado es **eduardo@eduescalante.com**.
- El botón dice **"Entrar con Google"** (texto por defecto, en español chileno).
- Se guardan de la cuenta de Google: correo, nombre y foto de perfil, para mostrar quién está conectado.
- El cobro del retrato ($2.990) sigue como está hoy (modo demo hasta conectar Mercado Pago real); lo nuevo es
  que el estado de pago queda guardado en la cuenta.
