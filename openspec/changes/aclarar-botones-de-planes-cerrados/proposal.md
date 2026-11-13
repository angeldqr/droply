# Proposal

## Why

Un destinatario con varios planes terminados conserva en su chat los botones de todos los mensajes
viejos. Al tocar uno, el bot contesta «Este ya no se puede responder», sin decir por qué, y parece
que la aplicación falló. Le pasó a un destinatario real el 12 de noviembre: tocó un mensaje de un
plan cerrado, recibió ese aviso, y los envíos del plan en marcha sí se anotaron después.

## What Changes

- Cuando el toque viene del chat del destinatario de ese envío y el envío ya no pertenece a un plan
  en marcha (porque terminó, se anuló o la biblioteca salió del plan), el bot contesta «Ese mensaje
  es de un plan que ya no está en marcha.».
- El toque desde un chat ajeno, o sobre un envío que no existe, sigue recibiendo el aviso genérico
  de siempre, sin decir por qué.

Fuera de alcance:

- Quitar los botones de los mensajes viejos al cerrar un plan.
- Cambiar qué respuestas se anotan: las tres condiciones de hoy siguen iguales.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `habits`: el requisito «Responder con los botones» dice qué contesta el bot cuando el destinatario
  toca un botón de un plan que ya no está en marcha.

## Impact

- `apps/api/src/habits`: el caso de uso de votar, el puerto del repositorio de planes y su
  adaptador Prisma.
- `apps/api/src/shared/habit-vote-sink.ts`: un resultado nuevo de la votación.
- `apps/api/src/recipients/application/handle-telegram-callback.ts`: el texto de ese resultado.
- `packages/contracts` y `prisma/schema.prisma`: no se tocan.
