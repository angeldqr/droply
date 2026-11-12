# Design

## Context

La API está partida en contextos que no pueden importarse entre sí (eslint-plugin-boundaries). Los
datos que el asistente necesita ya los calculan casos de uso de lectura que filtran por dueño:
`ReadHabitPlans` (con el día en curso), `ReadJournal`, `ListRecipients`, `ListSchedules`, los
repositorios de bibliotecas y el `DELIVERY_LOG`. El cliente eligió el plan gratuito de Groq (sin
entrenamiento con los datos y con retención cero opcional) y un historial que no se guarda.

## Goals / Non-Goals

**Goals:**
- Que ninguna instrucción al modelo sea lo único que separa una cuenta de otra.
- Reusar las lecturas existentes para que los porcentajes coincidan con las pantallas.
- Usar piezas ya construidas: AI SDK para el ciclo de herramientas y el streaming, `useChat` en la
  web y los componentes de chat de shadcn.
- Poder cambiar de proveedor tocando un solo archivo.

**Non-Goals:**
- Historial persistente, acciones, Telegram, búsqueda semántica sobre los textos.

## Decisions

- **Un puerto por contexto en `shared/assistant-source.ts`.** Cada módulo envuelve su lectura en un
  `AssistantSource` (`list` y, si aplica, `detail`) y lo exporta con su token. Es el mismo patrón de
  `HabitVoteSink`. `recipients` y `scheduling` pasan a `@Global` solo para exportarlo. La salida ya
  va recortada (textos a 160 caracteres, últimas 30 anotaciones y envíos, 50 elementos por
  biblioteca) porque cada token cuenta contra el tope diario.
- **Herramientas atadas en la aplicación, no en el modelo.** `AskAssistant` arma las nueve lecturas
  con el `ownerId` de la sesión dentro de un closure. El esquema de cada herramienta es vacío o un
  solo `id`, así que el modelo no tiene dónde poner otra cuenta.
- **Puerto `AssistantModel` que devuelve un `Response`.** El adaptador `GroqAssistantModel` usa
  `streamText` con `openai/gpt-oss-120b`, como mucho 5 pasos, razonamiento bajo y
  `toUIMessageStreamResponse`. El controlador copia estado y encabezados y manda el cuerpo con
  `reply.send` para no saltarse CORS ni helmet. Cambiar de proveedor es cambiar este adaptador.
- **Reglas y guía en `assistant/infrastructure/guia.ts`.** Es corta a propósito (menos de 1.500
  tokens) y va completa en cada pregunta. El contexto que cambia (nombre, fecha y zona de la cuenta)
  va aparte.
- **Solo texto en la ruta.** La web reduce cada mensaje a su texto y manda los 20 últimos. Así no se
  pueden colar resultados de herramientas inventados y el servidor no guarda estado.
- **Tope diario en memoria.** 15 preguntas por cuenta y día UTC, más `@Throttle` de 10 por minuto,
  que como todo el limitador del API cuenta por conexión (IP). El diario se pierde al reiniciar la
  API; con una sola réplica alcanza. La pregunta cuenta al aceptarse, aunque el proveedor falle
  después: así un proveedor caído no se puede martillar.
- **Fechas y veredictos ya escritos.** El modelo inventaba el día de la semana de "2026-11-11" y la
  fecha de hoy. `AskAssistant` pasa toda fecha de una lectura a palabras en la zona de la cuenta
  ("miércoles, 11 de noviembre"), y cada día de Mi bitácora y de un plan llega con su resultado
  ("cumplido", "día libre", "no cumplido, hizo 1 de 2"), el mismo que pinta la pantalla.
- **Tono en la guía.** Respuestas de una a tres frases, sin presentar la respuesta ni cerrar con
  ofrecimientos, con dos ejemplos. La web quita la negrita de markdown que el modelo a veces cuela.
- **Se corta al irse quien preguntó.** El controlador pasa una señal que se dispara al cerrarse la
  conexión, y `streamText` deja de generar.
- **Errores nuevos de dominio.** `rate_limited` → 429 y `unavailable` → 503 en el filtro HTTP.
- **Widget en `Providers`.** Montado solo con sesión, así sobrevive a la navegación y muere al cerrar
  sesión. Los componentes `message`, `bubble` y `message-scroller` salen por la CLI de shadcn;
  `prompt-input` y `suggestion` no existen para el estilo `radix-nova`, así que la caja usa el
  `input-group` ya instalado y las sugerencias son botones.

## Risks / Trade-offs

- **Cuota gratuita compartida:** unos 200.000 tokens al día para toda la aplicación, o sea de 30 a 50
  preguntas. Si se queda corta: Groq de pago u otro proveedor en el adaptador.
- **El modelo puede equivocarse al sumar.** Las lecturas traen los porcentajes ya calculados para que
  no tenga que hacerlo.
- **Inyección por texto guardado:** una nota podría intentar dar órdenes. Las reglas lo prohíben y,
  aunque lo lograra, las herramientas solo leen la propia cuenta.
- **La guía se desactualiza:** `openspec/config.yaml` pide actualizarla en cada cambio de
  comportamiento.
