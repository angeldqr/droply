# Mapa de specs

Cada contexto de `apps/api/src/` tiene, o va a tener, su spec en `specs/<contexto>/spec.md`. La spec
dice qué hace hoy el sistema. Los pedidos nuevos entran como cambios en `changes/` y, al
archivarse, actualizan la spec.

| Contexto | Spec | Qué cubre | Depende de |
|---|---|---|---|
| habits | [habits](specs/habits/spec.md) | Planes de hábitos, botones, cierre diario, informe y avisos de progreso | libraries, recipients, delivery |
| journal | pendiente | Mi bitácora: hábitos personales, `/hoy`, semana | identity (zona de la cuenta) |
| libraries | pendiente | Bibliotecas, elementos, baúl, edición de textos | — |
| identity | pendiente | Cuenta, sesión, verificación de correo, zona horaria | — |
| scheduling | pendiente | Horarios, recurrencia, zonas, horario de verano | libraries, recipients |
| delivery | pendiente | Selección, envío, reintentos, historial | scheduling, libraries, recipients |
| recipients | pendiente | Destinatarios, vinculación por Telegram, botones recibidos | — |
| admin | pendiente | Panel de administración | identity |
| assistant | en curso (changes/agregar-asistente) | Chat con IA: qué responde, qué lee y sus límites | habits, journal, libraries, recipients, scheduling, delivery |

Orden recomendado para las Reverse-Specs que faltan: journal → libraries → identity → recipients →
scheduling → delivery → admin.

## Ciclo de un cambio

1. `/opsx:propose <qué se quiere>`: crea `changes/<nombre>/` con la propuesta, el diseño, las tareas y
   el delta de la spec.
2. El cliente revisa y aprueba.
3. `/opsx:apply`: se implementan las tareas.
4. `/code-review`.
5. Commit (lo hace el cliente).
6. Despliegue.
7. `/opsx:archive`: el delta se funde en la spec viva.

Los cambios que tocan `packages/contracts` o `prisma/schema.prisma` no se trabajan en paralelo.
