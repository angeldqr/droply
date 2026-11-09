# Proposal

## Why

Un plan de hábitos toma la zona horaria del navegador desde donde se crea, mientras que Mi bitácora usa
la de la cuenta (el selector de Tu cuenta). Si no coinciden, el día del plan y el de la bitácora se
cortan a horas distintas. Es el mismo síntoma que reportó el cliente en Mi bitácora (un día contado
como el siguiente), esta vez en "Yo en 30 días".

## What Changes

- Un plan nuevo toma la zona horaria **de la cuenta** del dueño.
- La API deja de leer la zona que manda el navegador; si llega, se ignora y no da error.
- Los planes ya creados conservan su zona: no se migra nada.

Fuera de alcance:
- Cambiar la zona de un plan existente.
- Que un plan siga a la cuenta si después cambia su zona: se copia al crearlo.
- La regla de bibliotecas ocupadas en la pantalla de "Nuevo plan". Es más estricta que la API sin
  romper nada, y el cliente no lo pidió.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `habits`: "Zona horaria del plan" pasa a salir de la cuenta y no del navegador.

## Impact

- **API:** `apps/api/src/habits/` (crear un plan). Nuevo puerto para leer la zona de la cuenta,
  implementado en `infrastructure/prisma-directories.ts`; el controlador deja de pasar
  `body.timezone`.
- **Contrato:** toca `packages/contracts`. Se quita `timezone` de `createHabitPlanSchema`. Zod descarta
  las claves desconocidas, así que un cliente viejo que la mande sigue funcionando.
- **Web:** `apps/web/src/components/new-habit-plan-dialog.tsx` deja de mandar `browserTimezone()`.
- **Base de datos:** sin cambios en `prisma/schema.prisma` ni migraciones.
