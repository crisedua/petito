# Arreglo: no se puede completar la suscripción a Petito Plus en Mercado Pago

El checkout de Mercado Pago muestra el botón "Confirmar" en gris y no deja terminar la
suscripción. Este arreglo busca que el usuario sí pueda pagar, atacando la causa más
probable y explicando con claridad lo que Mercado Pago exige.

## Para quién es
Para el dueño de Petito y sus futuros suscriptores, que necesitan poder contratar Petito
Plus (mensual $3.900 / anual $29.900 CLP) sin quedarse trabados en la pantalla de pago.

## Qué está pasando (diagnóstico)
Mercado Pago, en las suscripciones sin plan asociado, **exige que el correo enviado por
Petito al crear la suscripción coincida exactamente con el correo de la cuenta de Mercado
Pago con la que la persona paga**. Si no coinciden, el pago se rechaza o el botón
"Confirmar" queda deshabilitado. Hoy Petito envía automáticamente el correo de la cuenta de
Google con la que el usuario entró a Petito; si esa persona usa otro correo en Mercado Pago,
el pago no se puede completar. Esta es la causa más probable del botón gris.

Hay además tres condiciones que **dependen de Mercado Pago y no se pueden cambiar desde
Petito**, solo explicar:
- El cobro de **$950 "para validar tu tarjeta"** (reembolsable) lo hace Mercado Pago. Si la
  tarjeta rechaza esa validación (seguridad del banco, débito con restricción para cargos
  automáticos, fondos), el botón también se bloquea.
- Las **tarjetas de débito** suelen tener más restricciones que las de crédito para cobros
  recurrentes; la de crédito es más confiable para una suscripción automática.
- **No se puede pagar una suscripción a la propia cuenta vendedora**: si la prueba se hace con
  la misma cuenta de Mercado Pago que recibe el dinero, Mercado Pago la bloquea. La prueba
  real debe hacerse con una cuenta/tarjeta distinta a la del vendedor.

## Core features y experiencia (lo que se construye)
- **Confirmar el correo de Mercado Pago antes de ir a pagar.** En la página de Petito Plus,
  al elegir plan, aparece un campo con el correo que se usará en Mercado Pago. Viene
  pre-llenado con el correo de la cuenta, pero es editable, con el texto: "Usa el mismo correo
  de tu cuenta de Mercado Pago". Ese correo es el que se envía a Mercado Pago, de modo que
  coincida y el botón "Confirmar" se habilite.
- **Aviso claro antes del checkout.** Un recuadro breve y cálido explica, antes de salir a
  Mercado Pago: que se cobran $950 reembolsables solo para validar la tarjeta, que conviene
  una tarjeta de crédito para el cobro automático, y que puede cancelar cuando quiera.
- **Mensajes de ayuda si algo falla.** Si al volver de Mercado Pago la suscripción no quedó
  activa, Petito muestra un mensaje amable con los motivos típicos (correo que no coincide,
  tarjeta de débito con restricción, validación de $950 rechazada) y un botón para reintentar.
- El resto del flujo actual se mantiene: se requiere iniciar sesión, y la activación de Plus
  se confirma en el servidor (solo cuando Mercado Pago informa el estado autorizado).

## User flow
1. El usuario entra a "Hazte Plus", elige mensual o anual.
2. Confirma (o corrige) el correo de su cuenta de Mercado Pago y lee el aviso de los $950 y la
   recomendación de tarjeta de crédito.
3. Toca "Suscribirme" y Petito lo lleva al checkout de Mercado Pago, ya con el correo
   coincidente.
4. Paga en Mercado Pago; al autorizar, vuelve a "Mi universo" con la insignia Plus.
5. Si el pago no se completa, vuelve a Petito y ve un mensaje claro con el motivo y la opción
   de reintentar.

## UI/UX feel
Sin rediseño. Se mantiene el tono cálido en español de Chile y la paleta dorada/terracota de
Petito Plus. El campo de correo y el aviso se integran como un paso natural y tranquilo antes
de pagar, sin tecnicismos ni alarmismo.

## Fases
- **Fase 1 (ahora, MVP):** correo de Mercado Pago confirmable antes del checkout (coincidencia
  de correo), aviso previo de los $950 + recomendación de tarjeta de crédito, y mensaje de
  ayuda al volver si el pago no se completó. Más la guía para probar el cobro real con una
  cuenta/tarjeta distinta a la del vendedor.
- **Fase 2 (después):** pantalla de gestión de la suscripción (ver plan, próxima fecha de
  cobro, cancelar manteniendo el acceso hasta el fin del período).
- **Fase 3 (futuro):** recordatorio cálido unos días antes de cada renovación y refuerzo de
  seguridad del webhook (secreto de firma) con validación de notificaciones de renovación.

## Supuestos
- La causa principal del botón gris es la falta de coincidencia del correo que exige Mercado
  Pago; por eso el arreglo central es permitir confirmar/editar ese correo antes de pagar.
- El cobro de $950, el comportamiento de las tarjetas de débito y el bloqueo de "pagarse a sí
  mismo" son de Mercado Pago y no se modifican desde Petito: solo se explican y se recomienda
  usar tarjeta de crédito y una cuenta distinta a la del vendedor para la prueba.
- Se mantienen los precios aprobados (mensual $3.900 / anual $29.900 CLP) y la activación
  confirmada en el servidor.
- El correo se pre-llena con el de la cuenta con la que el usuario entró, pero queda editable.
- La prueba del cobro real la hace el dueño con una tarjeta/cuenta de comprador real, distinta
  de la cuenta vendedora; esto no se puede automatizar.
- El arreglo aplica tanto al preview como a producción; para quedar en vivo en petito.pro hace
  falta re-publicar después del cambio.
