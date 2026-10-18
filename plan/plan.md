# Que el panel muestre a TODOS los usuarios que se registraron en petito.pro

El panel de administración en petito.pro muestra solo 2 usuarios (dos cuentas de prueba),
cuando deberían aparecer todas las personas que iniciaron sesión con Google en el sitio
publicado. Este trabajo encuentra por qué faltan y lo corrige para que la lista refleje a
todos los usuarios reales.

## Para quién es
Para el dueño de Petito, que necesita ver en el panel a todas las personas que realmente se
registraron (iniciaron sesión con Google) en petito.pro, para gestionar la comunidad.

## Qué está pasando (diagnóstico de partida)
- La app ya guarda un registro por cada persona que inicia sesión con Google, y el panel ya
  está hecho para listar a **todas** sin filtros ni límites prácticos. Es decir, el código que
  crea y lista usuarios es correcto.
- Por eso, que petito.pro muestre solo 2 usuarios —y que uno sea la cuenta de prueba
  "test.petito.norm@example.com", que es un dato sembrado para desarrollo— apunta a un problema
  de **datos/base de datos en producción**, no a la pantalla en sí. Las dos hipótesis más
  probables son:
  1. **El sitio publicado está leyendo/escribiendo en una base de datos equivocada** (por
     ejemplo, una base de prueba o vacía, distinta de donde se guardan los registros reales).
     Eso explicaría que aparezcan cuentas de prueba y no las reales.
  2. **El inicio de sesión con Google no se está completando en producción** (por configuración
     del login en el sitio en vivo), de modo que las personas no llegan a quedar registradas y
     por eso no hay registros que mostrar.
- La captura corresponde al sitio publicado (petito.pro), según lo confirmado.

## Qué se construye (Fase 1, MVP)
- **Leer la base de datos de producción y el flujo de inicio de sesión del sitio en vivo** para
  determinar con certeza cuál de las dos causas aplica: cuántos registros de usuario hay
  realmente en producción, en qué base de datos están, y si los inicios de sesión con Google en
  petito.pro están quedando guardados.
- **Corregir la causa encontrada** para que el panel liste a todos los usuarios que iniciaron
  sesión con Google en petito.pro:
  - Si el sitio está apuntando a una base de datos equivocada o distinta de donde están los
    registros reales, se corrige esa conexión para que el panel lea donde efectivamente se
    guardan los usuarios (puede requerir ajustar la configuración del sitio publicado y volver
    a publicar).
  - Si el inicio de sesión con Google no se completa en producción, se corrige para que cada
    inicio de sesión quede registrado correctamente.
- **Limpieza de datos de prueba en producción (si corresponde):** si en la base de producción
  quedaron cuentas de prueba (como "test.petito.norm@example.com"), se retiran para que el
  panel muestre solo usuarios reales. La cuenta de administrador del dueño se conserva.
- **Hacer evidente que están todos:** la lista muestra un **conteo total de usuarios** y se
  ordena del más reciente al más antiguo, para que a simple vista se note si aparecen todos.
- **Resultado esperado:** al abrir la pestaña "Usuarios" en petito.pro, aparecen todas las
  personas que iniciaron sesión con Google, con el total visible.

## User flow
1. El dueño entra al panel en petito.pro y abre "Usuarios".
2. Ve el total de usuarios y la lista completa, del más reciente al más antiguo.
3. Puede buscar por correo o nombre y abrir a cualquiera para gestionarlo (como hoy).

## UI/UX feel
Sin rediseño. Se mantiene la estética y el tono actuales del panel. El único cambio visible es
que ahora aparecen todos los usuarios reales, con un conteo total arriba y orden por más
reciente.

## Fases
- **Fase 1 (ahora, MVP):** leer la base de datos de producción y el inicio de sesión del sitio
  en vivo, identificar por qué faltan usuarios, corregir la causa (conexión a la base correcta
  o registro del login), retirar cuentas de prueba de producción si las hubiera, y mostrar el
  conteo total con orden por más reciente. Volver a publicar para que quede en vivo.
- **Fase 2 (después):** más detalle por usuario en la lista (fecha de registro, último inicio
  de sesión) y exportación de la lista.
- **Fase 3 (futuro):** métricas de actividad por usuario (mascotas, creaciones, uso) y
  segmentos para soporte y comunicación.

## Supuestos
- "Usuario" = solo quienes iniciaron sesión con Google en petito.pro (confirmado).
- Los usuarios reales se guardan en la base de datos de producción, que es **separada** de la
  del entorno de preview; por eso el preview solo tiene cuentas de prueba.
- La causa más probable es de datos/configuración en producción (base equivocada o login que no
  queda registrado), no de la pantalla, porque el código ya guarda y lista a todos los usuarios.
- Las cuentas de prueba que aparezcan en producción se consideran datos de desarrollo y se
  pueden retirar; la cuenta de administrador del dueño se mantiene.
- Si el arreglo implica ajustar la configuración del sitio publicado (por ejemplo, la conexión
  a la base de datos), hace falta volver a publicar petito.pro para que tome efecto.
- No se cambia el diseño ni las acciones del panel ya existentes (Plus de cortesía, eliminar,
  etc.).
