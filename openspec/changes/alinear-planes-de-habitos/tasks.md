# Tasks

## 1. Zona de la cuenta (API y contrato)

- [ ] 1.1 Agregar el puerto `AccountDirectory.timezoneOf(ownerId)` en `habits/domain/ports.ts` e
  implementarlo en `infrastructure/prisma-directories.ts`, que lee `users.timezone`. Cablearlo en
  `habits.module.ts`. Verifica: `pnpm --filter api typecheck`.
- [ ] 1.2 `CreateHabitPlan` toma la zona del puerto y pierde el parámetro `timezone`. El controlador
  deja de pasar `body.timezone`. Verifica: typecheck.
- [ ] 1.3 Quitar `timezone` de `createHabitPlanSchema` en `packages/contracts/src/habits.ts` y
  recompilar el paquete. Verifica: `pnpm --filter @reconectate/contracts build` y typecheck de api y
  web.
- [ ] 1.4 Agregar el fake del puerto en `habits/__tests__/support.ts`, más un test en `plan.spec.ts`:
  con la cuenta en America/Bogota, el plan queda en America/Bogota y su `startOn` es el día de Bogotá
  aunque en UTC ya sea el día siguiente. Verifica: `pnpm --filter api test`.

## 2. Bibliotecas ocupadas por destinatario (web)

- [ ] 2.1 `librariesInUse(plans, recipientId)` en `apps/web/src/lib/habits.ts`: solo los planes
  `ACTIVE` hacia ese destinatario; con `recipientId` vacío devuelve un mapa vacío. Verifica:
  typecheck de web.
- [ ] 2.2 En `new-habit-plan-dialog.tsx`:
  - usar el destinatario elegido;
  - al cambiarlo, quitar de `chosen` las bibliotecas ocupadas;
  - quitar `browserTimezone()`;
  - cambiar la ayuda a "Una biblioteca no puede estar en dos planes vivos hacia la misma persona;
    anular el otro la libera."

  Verifica: typecheck y lint de web.
- [ ] 2.3 Prueba manual en el navegador, con un plan vivo hacia A que use la biblioteca X:
  - "Nuevo plan" hacia A deshabilita X;
  - hacia B la deja elegir y el plan se crea;
  - cambiar de B a A con X marcada la desmarca.

## 3. Cierre

- [ ] 3.1 `pnpm --filter api test`, más typecheck y lint de api, web y contracts, en verde. El fallo
  conocido de DST en `occurrences.spec.ts` no cuenta.
- [ ] 3.2 `/code-review` contra esta spec y corregir lo que salga.
- [ ] 3.3 Dar el comando de commit (`git commit -F`, ASCII, sin atribución).

## Workflow follow-up

- Desplegar con el respaldo previo y `--profile apps`.
- `/opsx:archive alinear-planes-de-habitos` para fundir el delta en `openspec/specs/habits/spec.md`.
