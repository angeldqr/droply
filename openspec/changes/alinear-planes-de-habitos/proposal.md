# Proposal

## Why

La Reverse-Spec de `habits` encontró dos desfases, y en los dos el cliente o el usuario ve algo que no
cuadra:

1. **Bibliotecas ocupadas.** La API permite usar una biblioteca en planes vivos hacia personas
   distintas, que es la regla deliberada (migración `habitos_por_destinatario`). La pantalla
   "Nuevo plan" la bloquea para cualquier destinatario y dice "Una biblioteca solo puede estar en un
   plan a la vez".
2. **Zona horaria.** Un plan toma la zona del navegador al crearse, mientras Mi bitácora usa la de la
   cuenta (el selector de Tu cuenta). Si no coinciden, el día del plan y el de la bitácora se cortan
   a horas distintas.

## What Changes

- La pantalla "Nuevo plan" deshabilita una biblioteca solo si ya está en un plan vivo **hacia el
  destinatario elegido**. Al cambiar de destinatario, se quitan de la selección las que pasan a estar
  ocupadas. El texto de ayuda dice la regla real.
- Un plan nuevo toma la zona horaria **de la cuenta**. La API deja de leer la zona que manda el
  navegador; si llega, se ignora y no da error.
- Los planes ya creados conservan su zona: no se migra nada.

Fuera de alcance:
- Cambiar la zona de un plan existente.
- Que un plan siga a la cuenta si después cambia su zona: se copia al crearlo, como hoy.
- Cambiar la regla de la API sobre bibliotecas.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `habits`:
  - "Una biblioteca, un plan vivo por destinatario": el escenario de la pantalla pasa a aplicar la
    misma regla que la API.
  - "Zona horaria del plan": la zona sale de la cuenta, no del navegador.

## Impact

- **API:**
  - `apps/api/src/habits/` (crear un plan): nuevo puerto para leer la zona de la cuenta, implementado
    en `infrastructure/prisma-directories.ts`.
  - El controlador deja de pasar `body.timezone`.
- **Contrato:** toca `packages/contracts`. Se quita `timezone` de `createHabitPlanSchema`. No rompe a
  nadie, porque Zod descarta las claves desconocidas, así que un cliente viejo que la mande sigue
  funcionando.
- **Web:**
  - `apps/web/src/lib/habits.ts` (`librariesInUse` por destinatario).
  - `apps/web/src/components/new-habit-plan-dialog.tsx`: quita `browserTimezone()`, filtra por
    destinatario y cambia el texto.
- **Base de datos:** sin cambios en `prisma/schema.prisma` ni migraciones.
