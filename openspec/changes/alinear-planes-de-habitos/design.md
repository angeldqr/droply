# Design

## Context

- `CreateHabitPlan.execute(ownerId, input, timezone)` recibe la zona como argumento, y
  `HabitPlansController.create` le pasa `body.timezone`, que la web llena con `browserTimezone()`.
- `habits` no puede importar el dominio de `identity`. Mi bitácora (`journal`) resuelve lo mismo con un
  `timezoneOf(ownerId)` en su propio puerto, que lee `users.timezone` con Prisma.
- En la web, `librariesInUse(plans)` arma un mapa `libraryId → nombre del plan` con todos los planes
  `ACTIVE`, sin mirar `recipientId`. `HabitPlanSummary` ya trae `recipientId` y `libraryIds`.

## Goals / Non-Goals

**Goals:**
- Que la API lea la zona de la cuenta y no confíe en la del cliente.
- Que la pantalla calcule las bibliotecas ocupadas igual que la API.

**Non-Goals:**
- Una vista nueva de la API para las bibliotecas ocupadas: la lista de planes ya trae todo.

## Decisions

- **Puerto `AccountDirectory.timezoneOf(ownerId)` en `habits/domain/ports.ts`**, implementado en
  `prisma-directories.ts` junto a los otros directorios. Se descartó leerla en el controlador con
  `@CurrentUser`, porque el JWT no lleva la zona y añadirla obligaría a refrescar sesiones al
  cambiarla. También se descartó reutilizar el repositorio de `journal`, porque sería cruzar contextos.
- **`CreateHabitPlan` pierde el parámetro `timezone`** y la pide al puerto. Así un caso de uso no
  puede crear un plan con una zona ajena a la cuenta.
- **Quitar `timezone` del esquema del contrato**, en vez de dejarla opcional. Una clave opcional que
  se ignora invita a creer que sirve. Zod descarta claves desconocidas, así que no rompe a clientes
  viejos.
- **`librariesInUse(plans, recipientId)`**: filtra por `plan.recipientId === recipientId`. Sin
  destinatario elegido no hay nada ocupado. El diálogo poda `chosen` al cambiar de destinatario.

## Risks / Trade-offs

- [La cuenta del admin u otras quedaron en UTC] → ya se migraron a America/Bogota
  (`20261108120000_zona_horaria_bogota`), y el selector de Tu cuenta permite corregirla.
- [Una pestaña vieja abierta en otra zona] → no hay riesgo: la API ya no usa lo que manda.
