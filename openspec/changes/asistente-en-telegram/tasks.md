# Tasks

## 1. Comandos en el contrato

- [ ] 1.1 Agregar `JOURNAL_HELP_COMMAND = '/ayuda'` y `JOURNAL_ASK_COMMAND = '/preguntar'` en `packages/contracts/src/journal.ts`, y su copia en `apps/api/src/journal/domain/chat-actions.ts`. Se verifica con el guardián de `journal/domain/limits.spec.ts`, ampliado con las dos.
- [ ] 1.2 Publicar las cinco en el menú desde `recipients/infrastructure/telegram-connection.ts` («Primeros pasos y comandos», «Hacerle una pregunta al asistente»). Se verifica con un test del adaptador que lista `habitos`, `hoy`, `fin`, `ayuda` y `preguntar`, y ninguna en inglés.

## 2. El asistente con salida de texto

- [ ] 2.1 Crear `apps/api/src/shared/chat-assistant.ts` con el puerto `ChatAssistant` (`ask(ownerId, question)`) y su token `CHAT_ASSISTANT`.
- [ ] 2.2 En `AskAssistant`, sacar a un método privado lo común (contador, perfil, contexto y herramientas) y agregar `ask`, que devuelve texto. Agregar `reply` al puerto `AssistantModel` y al doble de tests. Tests:
  - la pregunta 16 del día, sumando web y Telegram, no llama al modelo y devuelve `AssistantDailyLimit`;
  - una pregunta de más de 2.000 caracteres no llama al modelo;
  - las lecturas que recibe el modelo son las de esa cuenta.
- [ ] 2.3 Implementar `GroqAssistantModel.reply` con `generateText`: el mismo modelo, `GUIA`, herramientas y pasos. La cuota agotada devuelve `LIMIT_MESSAGE` y otro error devuelve `FAILURE_MESSAGE`. El texto se corta en 4.000 caracteres. Se verifica con un test que simula el 429 envuelto en `RetryError`.
- [ ] 2.4 Volver `AssistantModule` `@Global` y exportar `CHAT_ASSISTANT`, implementado por `AskAssistant`. Se verifica con que la API arranca sin errores de inyección (`pnpm --filter @reconectate/api test`, que levanta el módulo en el e2e).

## 3. El bot en el chat de una cuenta

- [ ] 3.1 Agregar `typing(chatId)` a `ChatVoice` (`sendChatAction`), con su adaptador en `TelegramChatVoice` y su doble.
- [ ] 3.2 `/ayuda` en `journal-conversation.ts`: los primeros pasos, los comandos y la dirección de la web, sin tocar la anotación abierta. Tests: responde la ayuda, la anotación sigue abierta y `/ayuda` no queda como nota.
- [ ] 3.3 `/preguntar <pregunta>` en `journal-conversation.ts`: devuelve `true` enseguida y responde después, con «escribiendo…» cada 4 s hasta que sale la respuesta. Tests:
  - responde lo que devuelve el puerto;
  - el handler no espera al modelo, y se comprueba con un doble que tarda;
  - un error del puerto llega como texto al chat.
- [ ] 3.4 `/preguntar` solo: responde «¿Qué quieres saber?» y toma el siguiente texto dentro de 5 minutos, aunque haya una anotación abierta, sin guardarlo como nota. Tests:
  - la pregunta en dos mensajes;
  - un texto que llega a los 6 minutos se trata como siempre;
  - con una anotación abierta, la pregunta no queda en la anotación.

## 4. El bot en los demás chats

- [ ] 4.1 `/ayuda` en `recipients/application/handle-telegram-message.ts` para un chat sin cuenta: los envíos, los botones del plan y cómo conectar su chat quien tiene cuenta, sin nombrar `/preguntar`. Test en `recipients/__tests__/linking.spec.ts` o en uno nuevo.
- [ ] 4.2 `/preguntar` en un chat sin cuenta: «las preguntas son para quien tiene cuenta», sugiere `/ayuda` y no llama al asistente. Test con un doble que falla si se lo llama.

## 5. Guía y cierre

- [ ] 5.1 Actualizar `apps/api/src/assistant/infrastructure/guia.ts`: `/preguntar`, `/ayuda` y el tope compartido. Se verifica leyendo la guía junto a los textos del bot.
- [ ] 5.2 Typecheck, lint y test de `api` y `contracts`, y `pnpm exec openspec validate --all --strict`.
- [ ] 5.3 `/code-review` y sus correcciones.

## Workflow follow-up

- Comando de commit del cliente con `git commit -F`.
- Despliegue de la API: respaldo, `git pull --ff-only`, compose con `--profile apps`. Incluye el commit anterior (sesión y comandos en español), que todavía no se desplegó.
- En producción, `getMyCommands` del bot devuelve los cinco comandos. Probar `/ayuda` y `/preguntar` en el chat del cliente.
- `/opsx:archive asistente-en-telegram`, y la fila `telegram-bot` en `openspec/README.md`.
