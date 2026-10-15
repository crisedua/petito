# Que toda creación nueva diga "Petito" (y nunca más "Cuentapatas")

Fija la marca "Petito" de forma permanente en todo lo que Petito genera —videos, retratos
e historias— para que el nombre viejo "Cuentapatas" no vuelva a aparecer en ninguna
creación nueva, sin importar la configuración del servidor.

## Para quién es
Para el dueño de Petito, que vio el nombre viejo "Cuentapatas" grabado en un video de
"Petito Habla" en petito.pro y necesita que, de ahora en adelante, toda creación muestre
"Petito".

## Qué está pasando (diagnóstico)
- El nombre que se "quema" en los videos, retratos e historias viene de una marca que hoy el
  servidor puede configurar. El código ya trae "Petito" por defecto, pero producción puede
  quedar apuntando al nombre viejo, y entonces lo nuevo sale con "Cuentapatas".
- En los videos, el nombre queda grabado en los píxeles del video al momento de crearlo; por
  eso un video viejo seguirá mostrando "Cuentapatas" para siempre. Eso no se corrige en esta
  tarea (decisión acordada: los viejos se dejan como están).

## Qué se construye (Fase 1, MVP)
- **Marca fija "Petito" en todo lo que se genera.** Se deja "Petito" (y el sitio
  "petito.pro") como el único nombre que se graba en:
  - la marca de agua en diagonal y el nombre al pie del video de "Petito Habla",
  - la marca de agua del retrato en vista previa,
  - el nombre al pie de las diapositivas de las historias, el título, la portada y la
    diapositiva de cierre, y la vista previa bloqueada.
  Queda fijo en el propio producto, de modo que ninguna configuración del servidor pueda
  volver a cambiarlo por "Cuentapatas".
- **Resultado esperado:** cualquier creación nueva (video, retrato, historia) hecha después
  de publicar mostrará "Petito". Las creaciones viejas quedan intactas.
- **Sin cambios visuales de diseño:** mismo estilo, color y posición de la marca; solo cambia
  el texto a "Petito".

## User flow
1. El dueño (o cualquier usuario) crea un nuevo video de "Petito Habla", un retrato o una
   historia.
2. La marca grabada dice "Petito" y el sitio "petito.pro".
3. Los videos/imágenes creados antes del cambio siguen mostrando el nombre viejo; no se tocan.

## UI/UX feel
Sin rediseño. Se mantiene el tono cálido en español de Chile y la estética actual; el único
cambio perceptible es que el texto de marca ahora dice "Petito" en las creaciones nuevas.

## Fases
- **Fase 1 (ahora, MVP):** fijar "Petito"/"petito.pro" como marca en todas las creaciones
  nuevas, independiente de la configuración del servidor; dejar las creaciones viejas como
  están; re-publicar para que quede en vivo en petito.pro.
- **Fase 2 (después):** opción para que el dueño re-marque sin costo los retratos e historias
  ya creados (volver a aplicar "Petito" sobre la versión limpia guardada), si más adelante lo
  quiere.
- **Fase 3 (futuro):** regenerar videos "Petito Habla" viejos para reemplazar la marca grabada
  (implica reprocesar con IA), solo si se decide hacerlo.

## Supuestos
- La marca de Petito es permanentemente "Petito" y el sitio "petito.pro"; no se necesita que
  el nombre sea configurable, así que se fija en el producto para evitar que vuelva a cambiarse
  por error.
- Solo se corrigen las creaciones NUEVAS; las viejas (incluido el video que mostró
  "Cuentapatas") se dejan tal cual, según lo acordado.
- El arreglo cubre todos los tipos de creación (video que habla, retrato e historia) porque
  todos usan la misma marca.
- No hay cambios de diseño, posición ni estilo de la marca de agua; solo cambia el texto.
- Para que el cambio quede en vivo en petito.pro hace falta re-publicar después de aplicarlo.
