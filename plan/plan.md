# Verificación de Mercado Pago — Suscripción Petito Plus (producción)

Revisión de la suscripción Petito Plus en producción (petito.pro) hasta donde se puede
comprobar sin tarjeta, más un checklist claro para la prueba final de cobro real.

## Para quién es
Para el dueño de Petito, que necesita saber con certeza si la membresía Petito Plus
(mensual $3.900 / anual $29.900 CLP, renovación automática) está lista para cobrar de
verdad en producción antes de promocionarla.

## Qué se revisa y qué se entrega
- **Configuración de producción**: confirmar que el entorno desplegado tiene el token de
  Mercado Pago de producción (`APP_USR-`), que `FREE_MODE` está en `false` (paywall real
  activo) y qué otros secretos de pago existen (sin exponer sus valores).
- **Generación de checkout real**: pedir al backend de producción que cree una suscripción
  Preapproval de prueba y confirmar que devuelve un `init_point` real de Mercado Pago, con
  el monto y la frecuencia correctos (mensual y anual).
- **Cuenta de Mercado Pago habilitada**: deducir si "Suscripciones / Preapproval" está
  activo en la cuenta del dueño. Si la creación del checkout responde con error, se reporta
  el mensaje exacto de Mercado Pago (por ejemplo, suscripciones no habilitadas).
- **Confirmación del pago en el servidor**: verificar que la activación de Plus ocurre solo
  cuando Mercado Pago confirma el estado `authorized` (nunca por el simple regreso del
  navegador) y que el webhook de notificaciones está publicado y accesible en producción.
- **Webhook**: confirmar si está configurado el secreto de firma (opcional) y si la URL de
  notificación queda registrada/alcanzable.
- **Entrega final**: un checklist corto y claro para que el dueño haga la única prueba que
  no se puede automatizar — suscribirse con una tarjeta real y confirmar que el cobro se
  realiza, la membresía se activa y vuelve a "Mi universo".

## Flujo que se valida
1. El usuario entra a `/plus`, elige plan (mensual o anual) y toca suscribirse.
2. El backend crea la suscripción en Mercado Pago y devuelve el `init_point`.
3. El usuario es llevado al checkout alojado de Mercado Pago y autoriza con su tarjeta.
4. Mercado Pago confirma la suscripción (estado `authorized`) y notifica al webhook.
5. El servidor marca la membresía activa y el usuario regresa a "Mi universo" con la
   insignia Plus.
6. En cada renovación (mes/año), Mercado Pago notifica el pago y el servidor extiende el
   acceso.

## Resultado esperado de la revisión
Un informe simple de estado: qué está confirmado funcionando, qué falta (acciones del lado
de la cuenta de Mercado Pago o del panel de despliegue), y el checklist de la prueba con
tarjeta. No se cambia código de la aplicación en esta tarea.

## Fases
- **Fase 1 (ahora): Verificación + checklist.** Comprobaciones automáticas en producción
  (configuración, generación de checkout real, confirmación server-side, webhook) y entrega
  del informe de estado y el checklist de prueba con tarjeta.
- **Fase 2 (después, si se requiere): Endurecimiento.** Registrar/activar el secreto de
  firma del webhook y validar la recepción real de notificaciones de renovación.
- **Fase 3 (futuro): Gestión de la suscripción para el socio.** Pantalla donde el socio ve
  su plan y próxima fecha de cobro, cancela, y recibe aviso antes de la renovación.

## Supuestos
- La revisión es solo en **producción** (petito.pro), según lo indicado.
- Solo se verifica la **suscripción Petito Plus**; los pagos únicos quedan fuera de alcance.
  Nota: el código de pagos únicos (retrato/video/historia) todavía existe en la aplicación;
  si se desea retirarlos, es un cambio aparte y no forma parte de esta verificación.
- No se realiza ningún cobro real; la prueba final con tarjeta la hace el dueño.
- Para probar el checkout se creará **una** suscripción Preapproval real en estado pendiente.
  Esto no mueve dinero (no hay cargo hasta que una tarjeta la autorice); si no se desea
  crear ni siquiera ese contrato de prueba, se revisa solo la configuración.
- El token de producción `APP_USR-` del dueño se mantiene tal cual; no se modifica.
- La habilitación de "Suscripciones" en la cuenta de Mercado Pago es una acción del dueño;
  la revisión la confirma de forma indirecta y reporta el error exacto si no está activa.
- El secreto de firma del webhook (`MERCADOPAGO_WEBHOOK_SECRET`) es opcional: sin él, el
  webhook sigue siendo seguro porque el servidor vuelve a consultar el estado a Mercado Pago
  antes de dar acceso. Si se quiere agregar, es parte de la Fase 2.
