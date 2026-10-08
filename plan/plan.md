# Petito · Narración de la historia con la voz de la mascota (más lenta)

La mascota "cuenta" su propia historia: cada frase de las diapositivas se lee en voz alta mientras avanza el carrusel.
La narración va más lenta y clara, con voz de acento español nativo (ElevenLabs), queda integrada en la historia y suena también para quien abra el enlace compartido.

## Para quién es
Dueños de mascotas en Chile que quieren una historia más entretenida y tierna: en vez de solo leer, escuchan a su regalón "narrar" sus frases, ideal para mostrar a la familia o compartir por WhatsApp.

## Funcionalidad y experiencia
- **Narración por diapositiva**: cada frase de la historia (la línea en primera persona de la mascota) se lee en voz alta cuando esa diapositiva está en pantalla.
- **Voz con acento español nativo**: suena natural en español (sin dejo en inglés), gracias a ElevenLabs.
- **Más lenta**: la voz lee a un ritmo calmado para que se entienda bien y suene cálido, no apurado.
- **Sincronía con el carrusel**: el avance automático espera a que termine de leerse la frase antes de pasar a la siguiente diapositiva.
- **Música que acompaña**: la musiquita de fondo baja de volumen mientras la mascota habla y vuelve a subir al terminar la frase.
- **Controles simples**: un botón para activar o silenciar la narración y otro para repetir la frase de la diapositiva actual. La preferencia (con/sin narración) se recuerda.
- **Integrada y compartible**: la narración se genera junto con la historia y suena igual cuando alguien abre el enlace compartido.
- **Voz con personalidad**: al crear, se puede elegir entre un set acotado de voces en español, con una por defecto ya seleccionada.

## Flujo de uso
1. La persona crea su historia como siempre (mascota, tema, fotos).
2. La historia se genera incluyendo la narración de cada frase, con la voz por defecto o la que haya elegido.
3. Al reproducir, la mascota va "contando" cada diapositiva, lento y claro; la música baja mientras habla y el carrusel espera a que termine cada frase.
4. En cualquier momento puede silenciar/activar la narración o repetir la frase actual.
5. Al compartir el enlace, quien lo abra escucha la misma narración.

## Sensación de UI/UX
- Coherente con Petito: naranja/crema, tipografía redondeada, tono chileno y amable.
- En el reproductor de la historia, un control de narración (ícono tipo parlante/"contar") junto a los controles de música y play, con micro-animación al tocar.
- Al crear, un selector de voz compacto (chips o lista) con una opción por defecto; es opcional.
- Si la narración todavía se está generando, la frase igual se muestra en pantalla y la voz entra apenas está lista (sin bloquear la vista de la historia).
- No tapa el carrusel ni compite con el logo ni el botón de invitar.

## Fases de implementación
**Fase 1 — MVP (se construye ahora)**
- Narración por diapositiva de las frases de la mascota (título + frases de fotos + frases de escenas), leída en voz alta.
- Voz con acento español nativo (ElevenLabs, modelo multilingüe) usando tu propia API key.
- Velocidad más lenta para una lectura clara y tierna.
- Generación junto con la historia e integración en el enlace compartido.
- Música de fondo que baja mientras narra; avance automático que espera a que termine la frase.
- Activar/silenciar narración (recordado) y repetir la frase actual.
- Voz por defecto, con un set acotado de voces en español elegible al crear.

**Fase 2 — Más control (futuro)**
- Selector de velocidad (normal / lento / muy lento).
- Resaltar la frase o palabra a medida que se lee.
- Voz sugerida según el tema de la historia.

**Fase 3 — Exportar (futuro)**
- Descargar la narración como audio y/o exportar un video vertical con la voz + la música para subir a redes.

## Supuestos
- **Proveedor**: ElevenLabs con TU propia API key (no se usa la llave universal de Emergent). La key se guarda como secreto en el backend (nunca en el frontend). Como la compartiste en el chat, conviene rotarla en elevenlabs.io una vez integrada.
- **Modelo y voz**: modelo multilingüe (eleven_multilingual_v2) con voces nativas de español para buen acento. La velocidad lenta se ajusta en los parámetros de la voz.
- **Voces ofrecidas**: un set curado (~4) de voces en español con una por defecto de tono cálido/alegre; las voces concretas se eligen de tu cuenta de ElevenLabs al construir. Una voz por historia, elegible al crear.
- **Qué se narra**: las frases de la mascota (título y captions de las diapositivas de foto y de escenas IA). La diapositiva final de marca (petito.pro) no se narra; solo queda la música.
- **Cuándo se genera**: la narración se crea como parte de la historia (es texto, rápido), así queda lista al ver la historia y viaja en el enlace compartido. Si alguna frase aún se está generando, se muestra el texto y la voz entra apenas está lista.
- **Activada por defecto**: la narración viene activada, con un botón para silenciarla; la preferencia se recuerda (igual que el silencio de la música).
- **Costo**: el uso de voz se descuenta de TU cuenta/créditos de ElevenLabs según su precio por caracteres. El resto de la app sigue gratis para el usuario mientras está en modo gratuito.
- **Solo audio**: sin boca animada ni lip-sync (confirmado); es la voz leyendo, no un video de la mascota hablando.
- **Alcance**: disponible al crear y en la vista pública compartida; no aparece en el panel de administración.
- **Idioma**: toda la interfaz y los textos en español chileno.
