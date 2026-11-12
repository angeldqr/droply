# Proposal

## Why

El cliente quiere un asistente dentro de la aplicación que resuelva dudas sin salir de ella: cómo se
usa cada pantalla y cómo va la persona con sus propios datos (planes, días cumplidos y fallados,
bitácora, bibliotecas, envíos). Hoy esas respuestas exigen recorrer varias pantallas y sumar a mano.

## What Changes

- Un botón redondo abajo a la derecha, en todas las pantallas con sesión, abre un chat con el
  asistente.
- El asistente responde solo sobre Reconéctate y sobre los datos de la cuenta que pregunta. Rechaza
  cualquier otro tema, incluido escribir código.
- Lee los datos con permisos de solo lectura, siempre atados a la cuenta de la sesión. No puede
  crear, cambiar ni borrar nada.
- Usa un modelo de lenguaje del plan gratuito de Groq, con tope por minuto y por día para cada cuenta.
- La conversación vive solo en la pestaña: no se guarda en la base.
- Los avisos emergentes (toasts) pasan de abajo a la derecha a abajo al centro, para no tapar el
  botón.

Fuera de alcance:
- Guardar el historial de conversaciones o verlo desde otro dispositivo.
- Que el asistente haga acciones (crear planes, horarios, anotaciones).
- Responder por Telegram: el asistente está solo en la web.
- Mostrar el panel de administración o datos de otras cuentas, incluso a un administrador.

## Capabilities

### New Capabilities
- `assistant`: el asistente del chat: qué responde, qué datos puede leer, sus límites de uso y cómo
  se comporta sin proveedor.

### Modified Capabilities

## Impact

- `packages/contracts`: nuevo `assistant.ts` (cuerpo de la pregunta y sus topes) y la variable
  opcional `GROQ_API_KEY` en el esquema del entorno.
- `prisma/schema.prisma`: no cambia.
- API: nuevo contexto `assistant`, más una lectura exportada por `habits`, `journal`, `libraries`,
  `recipients`, `scheduling` y `delivery` (las dos últimas pasan a ser módulos globales para
  exportarla). Dos tipos nuevos de error de dominio: `rate_limited` (429) y `unavailable` (503).
- Web: el widget del asistente en `Providers`, `authorizedFetch` en `lib/api.ts`, y los componentes
  `message`, `bubble` y `message-scroller` de shadcn.
- Dependencias nuevas: `ai` y `@ai-sdk/groq` en la API; `ai`, `@ai-sdk/react` y `@shadcn/react` en
  la web.
- Despliegue: agregar `GROQ_API_KEY` al `.env` del servidor. Sin ella, todo lo demás funciona igual.
