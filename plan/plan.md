# Petito Plus: desbloquear la verificación del cobro y explicar el botón "Confirmar" en gris

El checkout de Mercado Pago deja "Confirmar" en gris porque se está pagando con la misma
cuenta que recibe el dinero (Mercado Pago no permite suscribirte a tu propia cuenta vendedora).
Este trabajo no reescribe el cobro —que ya genera un checkout real—; agrega una forma de
verificar toda la experiencia Plus sin pago real y explica con claridad cómo hacer la prueba
real con otra cuenta.

## Para quién es
Para el dueño de Petito, que necesita (1) comprobar que Petito Plus funciona de principio a fin
y (2) entender por qué Mercado Pago no lo deja confirmar el pago cuando prueba consigo mismo.

## Qué está pasando (diagnóstico confirmado)
- El botón "Confirmar" en gris **no es un error de Petito**. Ocurre porque la cuenta con la que
  se inicia sesión para pagar es **la misma cuenta vendedora** (la que recibe el dinero). Mercado
  Pago bloquea "pagarte a ti mismo". Los clientes reales nunca son el vendedor, así que no verán
  este bloqueo.
- No lo soluciona cambiar el correo (ya coincide), ni cambiar a tarjeta de crédito, ni cambiar el
  tipo de suscripción de Mercado Pago. La única forma de completar el pago es usar **otra cuenta
  de Mercado Pago distinta a la vendedora**.

## Core features y experiencia (lo que se construye en Fase 1)
- **Verificar Plus sin pago real (solo para el dueño).** Un control, visible únicamente para los
  correos de administrador, que permite activar y desactivar Petito Plus en la propia cuenta del
  dueño. Sirve para confirmar de inmediato toda la experiencia Plus: que se desbloquean retratos,
  videos e historias sin pago por unidad, que aparece la insignia Plus, y que se levantan los
  límites gratis (mascotas y reflexiones). Queda disponible también en producción, pero solo para
  los administradores; ningún usuario normal puede usarlo.
- **Mensaje de ayuda más claro cuando el pago no se completa.** El recuadro que ya aparece al
  volver sin suscripción activa encabeza ahora con el motivo real y más probable: "No puedes
  suscribirte con tu propia cuenta de Mercado Pago (la que recibe el dinero); prueba con otra
  cuenta". Mantiene los demás motivos (tarjeta con restricción, validación de $950 rechazada) en
  un tono cálido, sin tecnicismos.
- **Guía de prueba real entregada al dueño.** Pasos concretos para completar un cobro real:
  abrir el checkout en una ventana limpia, iniciar sesión con una **segunda cuenta de Mercado
  Pago** (no la vendedora), pagar con **tarjeta de crédito** de preferencia, aceptar el cargo de
  validación de $950 reembolsable, y confirmar que la suscripción queda activa y vuelve a "Mi
  universo" con la insignia Plus.

## User flow
1. El dueño entra a "Hazte Plus". Como es administrador, ve el control de verificación de prueba.
2. Activa Plus en modo prueba y recorre la app: retratos/videos/historias quedan desbloqueados,
   aparece la insignia Plus y se levantan los límites. Puede desactivarlo cuando termine.
3. Para el cobro real, sigue la guía: abre el checkout con otra cuenta de Mercado Pago y una
   tarjeta de crédito, confirma, y verifica que Plus queda activo.
4. Si algo falla al volver de Mercado Pago, ve el mensaje de ayuda encabezado por el motivo del
   autopago, con la opción de reintentar.

## UI/UX feel
Sin rediseño. Se mantiene el tono cálido en español de Chile y la paleta dorada/terracota de
Petito Plus. El control de verificación para el dueño se muestra discreto y claramente marcado
como herramienta de prueba, para no confundirse con el flujo de pago real de los clientes.

## Fases
- **Fase 1 (ahora, MVP):** verificación de Plus sin pago real solo para administradores (activar
  y desactivar), mensaje de ayuda encabezado por el bloqueo de autopago, y guía para completar el
  cobro real con una segunda cuenta.
- **Fase 2 (después):** pantalla de gestión de la suscripción para el socio (ver plan, próxima
  fecha de cobro, cancelar manteniendo el acceso hasta el fin del período).
- **Fase 3 (futuro):** recordatorio cálido antes de cada renovación, refuerzo de seguridad del
  webhook (secreto de firma) con validación de notificaciones de renovación, y un modo de prueba
  guiado con cuentas y tarjetas de prueba de Mercado Pago (sin dinero real).

## Supuestos
- La causa del botón "Confirmar" en gris es el bloqueo de Mercado Pago de pagarte a ti mismo,
  confirmado porque se paga con la misma cuenta vendedora. El flujo técnico de Petito ya es
  correcto (genera un checkout real de Mercado Pago).
- No se cambia el tipo de suscripción de Mercado Pago (sin plan asociado): cambiar a "con plan
  asociado" no elimina el bloqueo de autopago ni el requisito de correo, así que no resuelve esto.
- La activación de Plus en modo prueba queda restringida a los correos de administrador
  (allowlist existente) y disponible también en producción solo para ellos; incluye poder
  desactivarla.
- Se mantienen los precios aprobados (mensual $3.900 / anual $29.900 CLP) y la activación del
  cobro real confirmada en el servidor.
- La prueba del cobro real la hace el dueño con una segunda cuenta de Mercado Pago y, de
  preferencia, una tarjeta de crédito; esto no se puede automatizar.
- El arreglo aplica a preview y producción; para quedar en vivo en petito.pro hace falta
  re-publicar después del cambio.
