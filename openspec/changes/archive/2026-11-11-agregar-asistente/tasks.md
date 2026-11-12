# Tasks

## 1. Contrato y entorno

- [x] 1.1 `packages/contracts/src/assistant.ts`: esquema de la pregunta (solo texto, 1 a 20 turnos, termina en usuario, topes de 2.000 y 8.000)
- [x] 1.2 `GROQ_API_KEY` opcional en `apiEnvSchema` y en `.env.example`
- [x] 1.3 Errores de dominio `rate_limited` (429) y `unavailable` (503)

## 2. Lecturas por contexto

- [x] 2.1 `shared/assistant-source.ts` con el puerto, los seis tokens y `clip`
- [x] 2.2 Fuentes de `habits`, `journal`, `libraries`, `recipients`, `scheduling` y `delivery`, exportadas por su módulo
- [x] 2.3 Test: la fuente de planes no devuelve el plan de otra cuenta ni consulta con un id mal formado

## 3. Contexto `assistant`

- [x] 3.1 Puertos `AssistantModel` y `AccountReader`
- [x] 3.2 `AskAssistant`: herramientas atadas a la sesión, contexto con fecha y zona, tope diario, sin clave → no disponible
- [x] 3.3 `GroqAssistantModel` con AI SDK y la guía con las reglas en `guia.ts`
- [x] 3.4 `POST /api/assistant/chat` con `@Throttle` y streaming por `reply.send`
- [x] 3.5 Tests: cada lectura va con la cuenta de la sesión, id ajeno → inexistente, tope diario, sin clave, cuerpo inválido → rechazo

## 4. Web

- [x] 4.1 Componentes `message`, `bubble` y `message-scroller` por la CLI de shadcn
- [x] 4.2 `authorizedFetch` en `lib/api.ts`
- [x] 4.3 `AssistantWidget` con `useChat`, sugerencias, "Pensando…", errores y "Nueva conversación"
- [x] 4.4 Montarlo en `Providers` solo con sesión y pasar el `Toaster` a abajo al centro

## 5. Documentación

- [x] 5.1 Regla en `openspec/config.yaml`: los cambios de comportamiento actualizan `guia.ts`
- [x] 5.2 Fila `assistant` en `openspec/README.md`

## 6. Cierre

- [x] 6.1 Typecheck, lint y test de api, web y contracts
- [x] 6.2 Prueba en el navegador con `GROQ_API_KEY`: una pregunta de datos, una de uso, una de código y una sobre otra cuenta
- [x] 6.3 `/code-review`
