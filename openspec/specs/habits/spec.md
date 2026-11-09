# habits Specification

## Purpose

Planes de hábitos ("Yo en 30 días"). El dueño elige un destinatario vinculado, una o varias de sus
bibliotecas (cada una es un hábito) y un plazo. Mientras el plan está en marcha, cada envío de esas
bibliotecas llega con tres botones de respuesta. El sistema cierra cada día con su porcentaje y
manda un resumen. Al final manda un informe, y si el plan lo pidió, avisos de progreso durante el día.

Código: `apps/api/src/habits/`. Pantallas: `apps/web/src/app/yo-en-30-dias/`. Contrato:
`packages/contracts/src/habits.ts`.

## Requirements

### Requirement: Crear un plan
El sistema SHALL crear un plan en estado `ACTIVE` que arranca el día de hoy (en la zona del plan) y
termina `durationDays - 1` días después. El sistema MUST rechazar la creación cuando:
- el nombre, ya recortado, está vacío o pasa de 60 caracteres;
- el plazo no es 7, 14, 21 ni 30 días;
- hay cero bibliotecas o más de 20;
- los avisos de progreso no son un entero entre 0 y 6.

El sistema SHALL copiar al plan el nombre de cada biblioteca tal como estaba al crearlo.

#### Scenario: Plan de siete días
- **WHEN** el dueño crea un plan de 7 días un lunes
- **THEN** el plan arranca ese lunes y termina el domingo

#### Scenario: La biblioteca cambia de nombre o se borra
- **WHEN** una biblioteca del plan se renombra o se borra después de crearlo
- **THEN** el plan sigue mostrando el nombre con que entró

#### Scenario: Plazo inválido
- **WHEN** el dueño pide un plazo de 10 días
- **THEN** el sistema responde `habit_plan.invalid_duration`

### Requirement: Destinatario y bibliotecas válidos
El sistema MUST rechazar un plan cuando:
- el destinatario no es de la cuenta, o todavía no abrió su enlace (sin chat);
- alguna biblioteca no es de la cuenta o no existe;
- alguna biblioteca es el baúl.

Un destinatario o una biblioteca de otra cuenta MUST responderse como inexistente.

#### Scenario: Destinatario sin vincular
- **WHEN** el dueño elige un destinatario que no apretó Empezar
- **THEN** el sistema responde `habit_plan.recipient_not_linked`

#### Scenario: El baúl como hábito
- **WHEN** el dueño incluye su baúl
- **THEN** el sistema responde `habit_plan.vault_is_not_a_habit`

### Requirement: Una biblioteca, un plan vivo por destinatario
El sistema MUST impedir que una biblioteca esté en dos planes `ACTIVE` hacia el mismo destinatario,
y SHALL permitirlo hacia destinatarios distintos. Un índice único parcial en la base lo garantiza
aunque lleguen dos peticiones a la vez. Anular o terminar un plan libera sus bibliotecas.

#### Scenario: Misma persona
- **WHEN** la biblioteca ya está en un plan vivo hacia Ana y el dueño arma otro hacia Ana con ella
- **THEN** el sistema responde `habit_plan.library_already_in_plan` nombrando la biblioteca

#### Scenario: Otra persona
- **WHEN** la biblioteca ya está en un plan vivo hacia Ana y el dueño arma otro hacia Luis con ella
- **THEN** el plan se crea

#### Scenario: La pantalla de creación
- **WHEN** el dueño abre "Nuevo plan"
- **THEN** la pantalla deshabilita toda biblioteca que esté en cualquier plan vivo, sin importar el
  destinatario, con el texto "Ya es un hábito de «plan»" (más estricto que la API)

### Requirement: Zona horaria del plan
El sistema SHALL guardar en el plan la zona horaria de la cuenta del dueño en el momento de crearlo, y
SHALL cortar todos los días de ese plan con esa zona. La zona que mande el cliente MUST ignorarse.
Cambiar después la zona de la cuenta no mueve los días de planes ya creados.

#### Scenario: Plan creado desde Bogotá
- **WHEN** la cuenta y el navegador del dueño están en America/Bogota al crear el plan
- **THEN** cada día del plan va de medianoche a medianoche en Bogotá

#### Scenario: Cuenta en Bogotá, navegador en otra zona
- **WHEN** la cuenta está en America/Bogota y el dueño crea el plan desde un navegador en Europe/Madrid
- **THEN** el plan queda en America/Bogota y cada día va de medianoche a medianoche en Bogotá

#### Scenario: Plan creado antes del cambio
- **WHEN** un plan se creó con otra zona y el dueño cambia después la zona de su cuenta
- **THEN** ese plan conserva la zona con que se creó

### Requirement: Un plan no se edita
El sistema MUST NOT ofrecer ninguna forma de cambiar el nombre, las bibliotecas, el plazo ni los avisos
de un plan. Las únicas operaciones son anular, eliminar (si está anulado) y reenviar el informe (si
terminó).

#### Scenario: No hay ruta de edición
- **WHEN** alguien busca editar un plan en la API
- **THEN** no existe `PATCH /habit-plans/:id`

### Requirement: Anular un plan
El sistema SHALL anular un plan `ACTIVE` y dejarlo en `CANCELLED`. Antes, si el día de hoy sigue
dentro del plazo y no está cerrado, SHALL cerrarlo con lo que lleve. Anular un plan que no está en
marcha MUST responder `habit_plan.not_active`. Un plan anulado deja de cerrar días, de contar
respuestas y de mandar avisos.

#### Scenario: Anular a media tarde
- **WHEN** el dueño anula un plan con respuestas de hoy
- **THEN** el día de hoy queda cerrado con su porcentaje y el plan pasa a `CANCELLED`

#### Scenario: Anular dos veces
- **WHEN** el dueño anula un plan ya anulado
- **THEN** el sistema responde `habit_plan.not_active`

### Requirement: Eliminar un plan anulado
El sistema SHALL borrar del todo un plan `CANCELLED` junto con sus respuestas, días y bibliotecas.
MUST rechazar con `habit_plan.not_cancelled` un plan en marcha o terminado: los terminados son el
registro de lo logrado.

#### Scenario: Eliminar un anulado
- **WHEN** el dueño elimina un plan anulado
- **THEN** responde 204 y el plan ya no aparece en la lista

#### Scenario: Eliminar uno en marcha
- **WHEN** el dueño intenta eliminar un plan `ACTIVE`
- **THEN** el sistema responde `habit_plan.not_cancelled`

### Requirement: Responder con los botones
Cada envío de una biblioteca del plan SHALL llegar con tres botones: realizado (`DONE`), a medias
(`HALF`) y no cumplido (`MISSED`). El sistema SHALL anotar una respuesta solo si se cumplen las tres
condiciones:
- el envío es de un plan `ACTIVE`;
- el toque viene del chat de ese destinatario;
- el día **del envío**, en la zona del plan, todavía no está cerrado.

Una respuesta no se puede cambiar: el segundo toque no tiene efecto. Un toque desde un chat ajeno
se ignora sin decir por qué.

#### Scenario: Respuesta al día siguiente
- **WHEN** un envío de las 23:00 se contesta a las 7:00 del día siguiente y su día aún no cerró
- **THEN** la respuesta cuenta para el día del envío

#### Scenario: Día ya cerrado
- **WHEN** se toca un botón de un día ya cerrado
- **THEN** la respuesta no se anota y el bot avisa que ese día ya cerró

### Requirement: Porcentaje de un día
Por cada hábito y día, el sistema SHALL calcular `earned / sent × 100` con un decimal, donde:
- `sent` son los envíos de ese día hechos desde que existe el plan;
- `earned` suma DONE = 1, HALF = 0,5 y MISSED = 0;
- un envío sin respuesta cuenta 0.

Un día sin envíos MUST NOT tener porcentaje ("sin datos"), y no entra en ningún promedio.

#### Scenario: Cien envíos
- **WHEN** salen 100 envíos y 1 se marca realizado
- **THEN** el día vale 1%

#### Scenario: Envíos de antes de crear el plan
- **WHEN** el plan se crea a las 10:00 y ese día ya habían salido envíos a las 7:00
- **THEN** esos envíos no cuentan

### Requirement: Promedios
El porcentaje de un hábito SHALL ser el promedio de sus días con porcentaje. El del plan SHALL ser el
promedio de sus hábitos: cada hábito pesa igual sin importar cuántos archivos tenga. Sin datos no hay
promedio.

#### Scenario: Hábitos de distinto tamaño
- **WHEN** un hábito de 100 fotos va en 50% y uno de 5 audios en 100%
- **THEN** el plan va en 75%

### Requirement: Cierre diario y resumen
Cada 60 segundos el sistema SHALL cerrar, plan por plan, el siguiente día ya terminado en la zona del
plan, **un solo día por plan y por vuelta**, y en orden. Con el día escrito, SHALL mandar al
destinatario el resumen "«plan» · día N de M" con:
- una línea por cada hábito que tuvo envíos;
- el total del día;
- "Hoy no salió nada de este plan." si no hubo ninguno.

Si dos réplicas cierran el mismo día, solo una escribe y solo una avisa. Si un plan falla, los demás
siguen.

#### Scenario: Proceso caído tres días
- **WHEN** el proceso vuelve tras tres días caído
- **THEN** cierra los tres días, uno por vuelta, cada uno con su resumen

#### Scenario: Día en curso
- **WHEN** el día del plan todavía no termina en su zona
- **THEN** no se cierra

### Requirement: Fin del plan e informe
Al cerrar el último día, el sistema SHALL pasar el plan a `CLOSED` y mandar una sola vez el informe
"Terminó «plan»", con el promedio de cada hábito y el total del plan. El envío SHALL sellarse solo si
Telegram lo aceptó. El dueño SHALL poder reenviar el informe de un plan `CLOSED`. El reenvío MUST
responder:
- `habit_plan.not_closed` si el plan sigue en marcha;
- `habit_plan.recipient_not_linked` si no hay chat o Telegram lo rechaza.

#### Scenario: Informe que no sale
- **WHEN** Telegram rechaza el informe al terminar
- **THEN** el plan queda `CLOSED` sin fecha de envío y el dueño puede reenviarlo

### Requirement: Avisos de progreso
Si el plan pidió N avisos al día (1 a 6), el sistema SHALL mandarlos repartidos parejo entre las 8:00
y las 20:00 de la zona del plan, solo con el plan `ACTIVE` y dentro de su plazo. En cada vuelta SHALL
mandar como mucho el último horario ya pasado y sin enviar. MUST NOT mandar horarios anteriores a la
creación, ni repetir uno, ni mandar los atrasados en ráfaga. El horario se reclama antes de enviar.

#### Scenario: Reparto
- **WHEN** el plan pidió 1, 2 o 3 avisos
- **THEN** salen a las 20:00; a las 8:00 y 20:00; o a las 8:00, 14:00 y 20:00

#### Scenario: Proceso caído
- **WHEN** el proceso vuelve a las 21:00 sin haber mandado los de las 8:00 y 14:00
- **THEN** solo sale el de las 20:00

#### Scenario: Plan creado a las 15:00 con 3 avisos
- **WHEN** el plan nace a las 15:00
- **THEN** ese día no sale el aviso de las 8:00 ni el de las 14:00, y sí el de las 20:00

#### Scenario: Plan sin avisos
- **WHEN** el plan tiene 0 avisos al día
- **THEN** no se manda ninguno

### Requirement: Texto del aviso de progreso
El aviso SHALL decir "Avance plan «plan»" y "En este momento tu avance es:", con una línea por hábito.
La línea es "Hábito: X% (N notificaciones · M respuestas)", o "Hábito: sin envíos todavía" si ese
día no salió nada del hábito. El aviso MUST NOT llevar botones ni contar para el porcentaje.

#### Scenario: Un hábito con envío y otro sin
- **WHEN** Ejercicio tuvo 1 envío respondido como realizado y Leer no tuvo envíos
- **THEN** el aviso dice "Ejercicio: 100% (1 notificación · 1 respuesta)" y "Leer: sin envíos todavía"

### Requirement: Ver los planes
El sistema SHALL listar solo los planes del dueño, y SHALL mostrar el detalle solo de un plan del
dueño. El plan de otra cuenta MUST responderse como inexistente (`habit_plan.not_found`). La lista y
el detalle SHALL sumar al vuelo el día en curso de los planes `ACTIVE`, sin escribirlo. El detalle
SHALL traer la rejilla día por día de cada hábito, desde el inicio hasta hoy (o hasta el último día).

#### Scenario: Primer día
- **WHEN** un plan en su primer día ya tiene respuestas
- **THEN** la tarjeta de la lista y el detalle muestran el mismo porcentaje

### Requirement: Presentación del avance
La web SHALL pintar los porcentajes con tres bandas compartidas por la rejilla del plan, la gráfica
de consistencia y la semana de Mi bitácora:
- verde ≥ 80;
- ámbar entre 50 y 79;
- rojo < 50.

La gráfica de consistencia SHALL mostrar, por hábito, cuántos días con envío cayeron en cada banda
y su promedio.

#### Scenario: Día al 65%
- **WHEN** un día de un hábito vale 65%
- **THEN** su casilla y su tramo de la gráfica salen en ámbar
