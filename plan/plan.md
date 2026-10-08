# Petito · Rebrand + botón "Invitar amigos"

Dos cosas en un solo trabajo: (1) renombrar la marca de "Cuentapatas" a **Petito** en toda la app, y (2) agregar un botón fijo arriba para invitar amigos a la app.
El botón comparte un enlace a Petito (petito.pro) para que cualquiera invite a sus amigos a crear la historia de su mascota.

## Para quién es
Dueños de mascotas en Chile. El rebrand deja la marca correcta (Petito) en todas las pantallas, y el botón de invitar impulsa el crecimiento de boca en boca.

## Funcionalidad y experiencia

### 1) Rebrand a Petito
- Reemplazar todo el texto visible "Cuentapatas" por **Petito** (encabezados, inicio, flujo de creación, slide de cierre de la historia, panel de administración, textos varios).
- Actualizar el dominio/marca que aparece en las historias y en el pie, de "cuentapatas.cl" a **petito.pro**.
- Mantener el mismo estilo visual, íconos y tono chileno; solo cambia el nombre.

### 2) Botón "Invitar amigos"
- Botón fijo en la parte superior de la app, presente en inicio, flujo de creación y vista pública de una historia.
- Al tocarlo:
  - En celular con compartir nativo: abre la bandeja de compartir del teléfono (WhatsApp, mensajes, etc.) con mensaje y enlace listos.
  - Sin compartir nativo (ej. computador): copia el enlace al portapapeles y muestra confirmación ("Enlace copiado 🐾").
- El enlace apunta al inicio de la app (en producción, petito.pro) para que el amigo caiga directo a crear su propia historia.
- Mensaje por defecto en español chileno: "🐾 Crea la historia de tu mascota con humor chileno en Petito 👉 <enlace>".
- Un solo toque, sin cuenta ni datos.

## Flujo de uso
1. La persona está en cualquier pantalla de Petito y ve el botón "Invitar amigos" arriba.
2. Lo toca.
3. Elige por dónde enviarlo (o se copia el enlace solo).
4. El amigo abre el enlace y llega al inicio de Petito para crear su historia.

## Sensación de UI/UX
- Botón compacto y amable, coherente con la identidad (naranja/crema, tipografía redondeada, ícono de compartir o patita).
- Arriba a la derecha, sin competir con el botón "atrás" ni con el logo.
- Micro-animación al tocar y confirmación clara al copiar el enlace.
- No tapa contenido ni el carrusel; se integra al encabezado de cada pantalla.

## Fases de implementación
**Fase 1 — MVP (se construye ahora)**
- Rebrand completo "Cuentapatas" → "Petito" y dominio a petito.pro en todos los textos visibles.
- Botón "Invitar amigos" fijo arriba en inicio, creación y vista pública.
- Compartir nativo con respaldo de "copiar enlace" + confirmación, enlace al inicio de la app y mensaje en español chileno.

**Fase 2 — Seguimiento de invitaciones (futuro)**
- Enlace de invitación personalizado para medir cuántos amigos llegaron por cada persona.
- Opción de alternar entre "compartir la app" y "compartir esta historia".

**Fase 3 — Incentivos y más canales (futuro)**
- Recompensa por invitar (ej. desbloquear un tema o escena extra).
- Botones directos por canal (WhatsApp/Instagram) y código QR para compartir en persona.

## Supuestos
- El rebrand es solo de nombre/dominio visible (Cuentapatas → Petito, cuentapatas.cl → petito.pro); no cambia colores, logo ni estructura.
- El enlace del botón es el inicio de la app (dominio actual → petito.pro en producción); no comparte una historia específica.
- El mensaje de invitación usa el texto por defecto indicado; si se quiere otro, se ajusta.
- El botón "Invitar amigos" aparece en inicio, creación y vista pública, pero NO en el panel de administración.
- Se usa compartir nativo con "copiar enlace" como respaldo; sin integraciones ni backend nuevos.
