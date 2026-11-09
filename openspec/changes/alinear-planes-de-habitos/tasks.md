# Tasks

## 1. Zona de la cuenta

- [x] 1.1 Agregar el puerto `AccountDirectory.timezoneOf(ownerId)` en `habits/domain/ports.ts`.
  Implementarlo en `infrastructure/prisma-directories.ts` leyendo `users.timezone` y cablearlo en
  `habits.module.ts`. Verifica: `pnpm --filter api typecheck`.
- [x] 1.2 `CreateHabitPlan` toma la zona del puerto y pierde el parámetro `timezone`. El controlador
  deja de pasar `body.timezone`. Verifica: typecheck.
- [x] 1.3 Quitar `timezone` de `createHabitPlanSchema` en `packages/contracts/src/habits.ts` y
  recompilar el paquete. Quitar `browserTimezone()` de `new-habit-plan-dialog.tsx`. Verifica:
  `pnpm --filter @reconectate/contracts build` y typecheck de api y web.
- [x] 1.4 Agregar el fake del puerto en `habits/__tests__/support.ts` y dos tests en `plan.spec.ts`:
  - el plan queda con la zona de la cuenta;
  - cambiar después la zona de la cuenta no mueve un plan ya creado.

  Verifica: `pnpm --filter api test`.

## 2. Cierre

- [x] 2.1 Correr `pnpm --filter api test` y el typecheck y el lint de api, web y contracts; todo debe
  quedar en verde. El fallo conocido de DST en `occurrences.spec.ts` no cuenta.
- [x] 2.2 `/code-review` contra esta spec y corregir lo que salga.
- [x] 2.3 Dar el comando de commit (`git commit -F`, ASCII, sin atribución).

## Workflow follow-up

- Desplegar con el respaldo previo y `--profile apps`.
- `/opsx:archive alinear-planes-de-habitos` para fundir el delta en `openspec/specs/habits/spec.md`.
