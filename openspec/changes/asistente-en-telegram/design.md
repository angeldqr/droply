# Design

## Context

- **Cómo entra un mensaje.** Llega por el webhook (`recipients/presentation/telegram.controller.ts`)
  o por el sondeo largo en desarrollo. Las dos puertas llaman a `HandleTelegramMessage`. La bitácora
  (`journal/application/journal-conversation.ts`, por el puerto `JournalInbox`) tiene primera opción:
  se queda con lo que es del chat de una cuenta y devuelve `false` para todo lo demás. Lo demás cae
  en el camino de los destinatarios, que hoy contesta a todo con «abre el enlace».
- **El asistente** (`assistant/application/ask-assistant.ts`):
  - Arma las lecturas atadas al `ownerId` y lleva el contador diario en memoria.
  - Llama a `AssistantModel.answer`, que devuelve el stream que entiende la web
    (`toUIMessageStreamResponse`).
  - Lee a los demás contextos por `AssistantSource` en `shared/`, y por eso depende de `journal`
    (`JOURNAL_SOURCE`).
- **Lo que hace falta para Telegram:** texto plano y no un stream. Además, la bitácora tiene que
  poder llamar al asistente, que a su vez lee de ella.
- **El bot habla por dos clientes HTTP propios:** `TelegramChatVoice` en `journal` y
  `TelegramChannelGateway` en `recipients`. Los dos fallan en silencio a propósito.

## Goals / Non-Goals

**Goals:**
- Una sola fuente de verdad para el asistente: mismas lecturas, mismas reglas y el mismo contador
  para la web y Telegram.
- Que el webhook conteste rápido aunque el modelo tarde.
- No romper la regla de arquitectura: ningún contexto importa el `application/` ni el `domain/` de
  otro.

**Non-Goals:**
- Guardar la conversación ni la pregunta pendiente en la base.
- Dar formato a la respuesta (Markdown o HTML de Telegram): va como texto plano, como en la web.

## Decisions

### Un puerto `ChatAssistant` en `shared/`, como `HabitVoteSink`
- `shared/chat-assistant.ts` declara `ask(ownerId, question): Promise<Result<string, DomainError>>`
  y su token `CHAT_ASSISTANT`.
- `AssistantModule` pasa a `@Global` y lo exporta, implementado por `AskAssistant`.
- `JournalModule` lo inyecta en `JournalConversation`.
- Los dos módulos ya son globales, y el grafo de proveedores no tiene ciclos:
  - `AskAssistant` depende del `JOURNAL_SOURCE`.
  - `JournalConversation` depende de `CHAT_ASSISTANT`.
  - Ninguno depende del otro proveedor.
- *Alternativa descartada:* que el controlador del webhook llame al asistente. La decisión de qué
  hacer con un mensaje vive en la bitácora, que sabe si el chat es de una cuenta y si hay una
  anotación abierta. Partirla en dos lugares haría que el orden importara.

### `AskAssistant` con dos salidas sobre una misma preparación
- La parte común sale a un método privado: el contador, el perfil, el contexto con la fecha y las
  herramientas.
- `execute` sigue devolviendo el `Response` en stream para la web.
- `ask` devuelve el texto llamando a `AssistantModel.reply`.
- **`GroqAssistantModel.reply`** usa `generateText` con el mismo modelo, `GUIA`, herramientas y
  `stopWhen`, y devuelve `result.text`.
  - La cuota agotada (`isQuotaError`) responde el mismo `LIMIT_MESSAGE`.
  - Cualquier otro error responde el mismo `FAILURE_MESSAGE`.
  - Así el chat nunca recibe una excepción.
- El tope diario sale del mismo `Map`, así que se comparte de por sí.
- *Alternativa descartada:* leer el stream de `answer` en el servidor y juntarlo. Es más código y
  arrastra el formato de la web.

### Responder fuera del ciclo del webhook
- `handle` decide y devuelve `true` enseguida.
- La respuesta del modelo corre después, sin `await`, en una promesa con su propio `catch`, que
  avisa por log.
- Así el webhook no espera de 5 a 20 segundos y Telegram no reintenta el mismo update, que
  terminaría en preguntas duplicadas y en contador gastado dos veces.
- **Mientras tanto**, `ChatVoice.typing(chatId)` manda `sendChatAction: typing` al empezar y cada 4
  segundos, porque Telegram lo apaga a los 5, hasta que sale la respuesta.

### La pregunta pendiente, en memoria
- Un `Map<chatId, venceA>` en `JournalConversation` guarda el «`/preguntar` solo» durante 5
  minutos.
- El primer mensaje de texto de ese chat dentro del plazo es la pregunta, aunque haya una anotación
  abierta: el usuario acaba de pedir preguntar. Después se borra.
- Una foto, un comando o el plazo vencido la borran sin preguntar.
- `ponytail:` se pierde si la API se reinicia, y no se comparte entre réplicas. Hoy hay una sola.
  Si algún día molesta, se pasa a una columna de `AccountChat`.

### Comandos y textos
- **Constantes:** `JOURNAL_HELP_COMMAND = '/ayuda'` y `JOURNAL_ASK_COMMAND = '/preguntar'` van en
  `packages/contracts/src/journal.ts`, con su copia en `journal/domain/chat-actions.ts`. El test
  guardián de `limits.spec.ts` las ata.
- **Menú:** `telegram-connection.ts` publica las cinco.
- **Dónde se reconoce `/preguntar`:** con texto detrás se reconoce aparte de `isCommand`, que exige
  el comando solo, con una expresión como la de `/start <código>`.
- **Chats de cuenta:** `/ayuda` y `/preguntar` los atiende `journal-conversation.ts`.
- **Los demás chats:** `handle-telegram-message.ts` reconoce `/ayuda` y `/preguntar` antes de su
  respuesta de «abre el enlace».
- **Los textos** van en los objetos `SAYS` y `REPLIES` de cada archivo, que es donde el proyecto
  junta lo que dice el bot.
- **La ayuda de la cuenta** termina con la dirección de la web (`WEB_URL`). Telegram la vuelve
  enlace sin necesidad de formato.

### La guía del asistente
`guia.ts` suma una línea:
- Desde Telegram se puede preguntar con `/preguntar`.
- `/ayuda` da los primeros pasos.
- Las preguntas por Telegram cuentan para el mismo tope diario.

## Risks / Trade-offs

- **[El modelo tarda y el usuario escribe otra cosa]** → El «escribiendo…» avisa. Si igual manda un
  texto, se trata como siempre (anota o pide `/habitos`). La respuesta llega después, sola.
- **[Dos `/preguntar` seguidos]** → Corren en paralelo, cada uno gasta su pregunta y contesta por
  separado. Se acepta: es lo mismo que hacer dos preguntas en la web.
- **[La respuesta pasa de 4.096 caracteres, el máximo de Telegram]** → `maxOutputTokens: 1_500` la
  deja muy por debajo. Si igual se pasa, se corta en 4.000 con «…» antes de mandarla.
- **[Prompt injection por Telegram]** → Las mismas reglas de `GUIA` y las mismas lecturas atadas al
  `ownerId`. El texto del chat solo llega como pregunta del usuario, nunca como instrucción del
  sistema.
- **[La API se reinicia con preguntas en vuelo]** → Esas respuestas se pierden y el usuario vuelve a
  preguntar. El contador en memoria también se reinicia, como hoy.

## Migration Plan

- No hay migración de base.
- Al desplegar, la API republica el menú del bot con los cinco comandos.
- **Para volver atrás** basta desplegar el commit anterior: el menú vuelve a ser el de antes en el
  siguiente arranque.
