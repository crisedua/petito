# Panel de administración: gestionar usuarios, planes, perfiles y creaciones

Da al administrador de Petito el control para gestionar la comunidad desde el panel: ver
usuarios, otorgar o quitar Petito Plus de cortesía, y eliminar perfiles de mascota, cuentas
completas o creaciones puntuales cuando haga falta.

## Para quién es
Para el dueño de Petito (y cualquier correo en la lista de administradores), que necesita
moderar y dar soporte: activar Plus a alguien, borrar contenido inapropiado o de prueba, y
limpiar cuentas o mascotas duplicadas.

## Core features y experiencia (Fase 1, MVP)
Todo esto queda disponible solo para administradores, tanto en preview como en producción.

- **Nueva vista "Usuarios" en el panel.** Lista de todas las personas registradas, con
  buscador por correo o nombre. Cada usuario muestra su correo, nombre, si es Plus, y cuántas
  mascotas y creaciones tiene.
- **Cambiar el plan (Plus de cortesía).** Desde un usuario, el admin puede **activar** o
  **quitar** Petito Plus con un toque. Es un acceso de cortesía: no genera ningún cobro en
  Mercado Pago y puede revertirse cuando se quiera. (No se eligen mensual/anual ni fecha: solo
  Plus sí/no.)
- **Eliminar un perfil de mascota.** Borra una mascota puntual y su contenido asociado
  (recuerdos y creaciones ligadas a ella), tras confirmar.
- **Eliminar una cuenta de usuario completa.** Borra al usuario junto con todas sus mascotas,
  recuerdos y creaciones, tras una confirmación clara (acción fuerte).
- **Eliminar creaciones.** El admin puede borrar **historias, retratos y videos** de forma
  individual, tras confirmar. La lista de creaciones del panel se amplía para incluir los tres
  tipos (hoy solo muestra historias).
- **Confirmación antes de borrar.** Toda eliminación pide confirmación y es **permanente**
  (no hay papelera ni deshacer).

Lo que ya existe se mantiene: KPIs, encuesta y la lista de creaciones con filtros y "Ver".

## User flow
1. El admin entra al panel y abre la pestaña **Usuarios**.
2. Busca a una persona por correo o nombre y la abre.
3. Ahí puede: activar o quitar **Plus**; ver sus **mascotas** y **creaciones**; **eliminar**
   una mascota, una creación, o la **cuenta completa**.
4. Cada borrado pide confirmación; al confirmar, el cambio es inmediato y permanente.
5. Alternativamente, desde la lista general de creaciones (ahora con historias, retratos y
   videos) puede eliminar una creación puntual sin pasar por el usuario.

## UI/UX feel
Sin rediseño. Se mantiene la estética actual del panel (tarjetas blancas, acentos terracota,
tono cálido en español de Chile). Las acciones destructivas (eliminar cuenta/mascota/creación)
se muestran claramente diferenciadas en rojo y siempre detrás de una confirmación, para evitar
borrados accidentales.

## Fases
- **Fase 1 (ahora, MVP):** vista de Usuarios con buscador; activar/quitar Plus de cortesía;
  eliminar mascota, cuenta completa y creaciones (historias, retratos y videos); confirmaciones
  antes de borrar. Re-publicar para que quede en vivo en petito.pro.
- **Fase 2 (después):** registro de acciones del administrador (quién hizo qué y cuándo) y
  poder cancelar una suscripción **real** de Mercado Pago de un usuario desde el panel.
- **Fase 3 (futuro):** más moderación y soporte: suspender temporalmente una cuenta, reenviar
  enlaces, exportar datos de un usuario, y métricas por usuario.

## Supuestos
- "Eliminar perfiles" cubre **ambas** cosas: eliminar una mascota puntual y eliminar una
  cuenta de usuario completa (con todo su contenido).
- "Cambiar el plan" significa **solo activar o quitar Plus** como cortesía, sin cobro en
  Mercado Pago y reversible; no se eligen mensual/anual ni fecha de vencimiento en esta fase.
- "Eliminar creaciones" cubre los **tres tipos**: historias, retratos y videos.
- Se agrega una **vista de Usuarios** al panel para gestionar planes y perfiles.
- El acceso de administrador sigue basándose en la lista de correos permitidos existente
  (ningún usuario normal ve ni puede usar estas acciones).
- Todos los borrados son **permanentes** y piden confirmación; no hay papelera ni deshacer en
  esta fase.
- Las creaciones ya generadas que se eliminen dejan de estar disponibles por su enlace público.
- Para que el cambio quede en vivo en petito.pro hace falta re-publicar después de aplicarlo.
