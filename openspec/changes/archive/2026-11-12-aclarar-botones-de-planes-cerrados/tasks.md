# Tasks

## 1. Votación

- [x] 1.1 Agregar el resultado `ENDED` a `HabitVoteOutcome` y su texto en `handle-telegram-callback.ts`. Se verifica con el typecheck de la API.
- [x] 1.2 Agregar al repositorio de planes la consulta del chat del destinatario de un envío, haya plan o no, en el adaptador Prisma y en el doble en memoria. Se verifica con el typecheck.
- [x] 1.3 En `CastHabitVote`, devolver `ENDED` cuando no hay plan en marcha y el chat es el del destinatario. Tests en `voting.spec.ts` de los dos escenarios nuevos: plan anulado tocado desde el chat del destinatario da `ENDED`; desde un chat ajeno da `IGNORED`.

## 2. Cierre

- [x] 2.1 Typecheck, lint y test de `api`, y `openspec validate --all --strict`.
- [x] 2.2 `/code-review`.

## Workflow follow-up

- Comando de commit del cliente, despliegue y `/opsx:archive`.
