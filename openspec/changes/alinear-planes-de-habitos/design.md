# Design

## Context

- Hoy `CreateHabitPlan.execute(ownerId, input, timezone)` recibe la zona como argumento.
  `HabitPlansController.create` le pasa `body.timezone`, que la web llena con `browserTimezone()`.
- `habits` no puede importar el dominio de `identity`. Mi bitácora (`journal`) resuelve lo mismo con un
  `timezoneOf(ownerId)` en su propio puerto, que lee `users.timezone` con Prisma.

## Goals / Non-Goals

**Goals:**
- Que la API lea la zona de la cuenta y no confíe en la del cliente.

**Non-Goals:**
- Cambiar la zona de planes existentes.

## Decisions

- **Puerto `AccountDirectory.timezoneOf(ownerId)` en `habits/domain/ports.ts`**, implementado en
  `prisma-directories.ts` junto a los otros directorios. Lee `users.timezone` igual que `journal`.
  - Se descartó leerla en el controlador desde la sesión: el JWT no lleva la zona, y añadirla
    obligaría a refrescar sesiones cada vez que cambie.
  - Se descartó reutilizar el repositorio de `journal`: cruzaría contextos.
- **`CreateHabitPlan` pierde el parámetro `timezone`** y la pide al puerto. Así ningún llamador puede
  crear un plan con una zona ajena a la cuenta.
- **Quitar `timezone` del esquema del contrato**, en vez de dejarla opcional. Una clave opcional que se
  ignora invita a creer que sirve. Zod descarta claves desconocidas, así que no rompe clientes viejos.

## Risks / Trade-offs

- [Una cuenta con la zona mal puesta] → las cuentas en UTC ya se migraron a America/Bogota
  (`20261108120000_zona_horaria_bogota`), y el selector de Tu cuenta permite corregirla.
- [Una pestaña vieja que manda la zona] → no hay riesgo: la API ya no la usa.
