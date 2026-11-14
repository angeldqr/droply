# Proposal

## Why

En Telegram nadie explica cómo funciona Reconéctate. Quien abre el bot por primera vez no sabe qué
hacer, y para hacerle una pregunta al asistente hay que abrir la web. El bot es donde la gente ya
está todos los días, así que la ayuda y las preguntas también tienen que estar ahí.

## What Changes

- **`/ayuda`:** un comando nuevo con los primeros pasos y los comandos del bot, en español y en el
  tono de la app.
  - **A un dueño de cuenta**, con el chat conectado desde Mi bitácora: cómo se arma una biblioteca,
    un destinatario y un horario; cómo se anota en la bitácora con `/habitos`, `/hoy` y `/fin`; y
    que puede preguntar con `/preguntar`.
  - **A cualquier otro chat** (un destinatario o alguien sin vincular): cómo llegan los envíos y qué
    significan los botones de un plan. Si tiene cuenta, cómo conectar su chat.
- **`/preguntar <pregunta>`:** le hace la pregunta al mismo asistente de la web y le contesta en el
  chat.
  - Mismos datos (solo los de la cuenta del chat), mismas reglas (solo lectura, tema cerrado) y el
    mismo tope de 15 preguntas al día. El tope se comparte con la web.
  - Si se manda `/preguntar` solo, el bot pregunta «¿Qué quieres saber?» y toma el mensaje siguiente
    como la pregunta.
  - En un chat que no está conectado a una cuenta, responde que las preguntas son para quien tiene
    cuenta y sugiere `/ayuda`.
  - Mientras el modelo piensa, el chat muestra «escribiendo…».
- **El menú del bot** suma `ayuda` y `preguntar` a `habitos`, `hoy` y `fin`.
- **Queda escrito** en una spec lo que ya hace el menú en español: `/habits` sigue como alias
  oculto, y `/start` no se renombra.
- **La guía del asistente** (`guia.ts`) aprende los dos comandos nuevos.

**Fuera de alcance:**
- Que el asistente haga cosas. Sigue siendo de solo lectura, por decisión del cliente.
- Memoria de la conversación en Telegram: cada `/preguntar` es una pregunta suelta.
- Contestar mensajes sueltos sin comando.
- Que un destinatario le pregunte al asistente.
- Fotos o audios como pregunta.
- Botones para abrir pantallas de la web.

## Capabilities

### New Capabilities
- `telegram-bot`: lo que el bot ofrece en el chat. Su menú de comandos en español, `/ayuda` según
  quién escribe, y cómo responde `/preguntar` donde no hay cuenta.

### Modified Capabilities
- `assistant`:
  - Nuevo requisito: el asistente también responde desde Telegram, al dueño del chat conectado.
  - «Límites de uso» cambia: el tope diario se cuenta entre la web y Telegram juntos, y el mensaje
    del tope y el de la cuota del proveedor también salen en el chat.

## Impact

- **API:**
  - **`assistant`:** `AskAssistant` gana una salida en texto plano, además del stream de la web.
    `AssistantModel` gana `reply`, que usa `generateText` del AI SDK.
  - **Puerto nuevo** `shared/chat-assistant.ts`: el asistente lo exporta con su token y `journal`
    lo usa, como pasa con `HabitVoteSink`.
  - **`journal`:** `journal-conversation.ts` atiende `/ayuda` y `/preguntar` en el chat de la
    cuenta. `ChatVoice` gana `typing`.
  - **`recipients`:** `handle-telegram-message.ts` atiende `/ayuda` y `/preguntar` en los demás
    chats. `telegram-connection.ts` publica el menú nuevo.
- **`packages/contracts`:** constantes `JOURNAL_HELP_COMMAND` y `JOURNAL_ASK_COMMAND`, junto a las
  demás.
- **`prisma/schema.prisma`:** no cambia. La pregunta pendiente después de un `/preguntar` solo vive
  en memoria unos minutos.
- **Web:** no cambia, salvo los textos que nombran comandos, si alguno nombra la ayuda.
- **Sin dependencias nuevas:** `generateText` es del mismo paquete `ai`.
