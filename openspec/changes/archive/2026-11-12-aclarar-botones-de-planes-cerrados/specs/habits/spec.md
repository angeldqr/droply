# Spec Delta

## MODIFIED Requirements

### Requirement: Responder con los botones
Cada envío de una biblioteca del plan SHALL llegar con tres botones: realizado (`DONE`), a medias
(`HALF`) y no cumplido (`MISSED`). El sistema SHALL anotar una respuesta solo si se cumplen las tres
condiciones:
- el envío es de un plan `ACTIVE`;
- el toque viene del chat de ese destinatario;
- el día **del envío**, en la zona del plan, todavía no está cerrado.

Una respuesta no se puede cambiar: el segundo toque no tiene efecto. Un toque desde un chat ajeno
se ignora sin decir por qué.

Cuando el toque viene del chat del destinatario de ese envío pero el envío ya no pertenece a un
plan `ACTIVE`, la respuesta no se anota y el bot SHALL avisar que ese mensaje es de un plan que ya
no está en marcha.

#### Scenario: Respuesta al día siguiente
- **WHEN** un envío de las 23:00 se contesta a las 7:00 del día siguiente y su día aún no cerró
- **THEN** la respuesta cuenta para el día del envío

#### Scenario: Día ya cerrado
- **WHEN** se toca un botón de un día ya cerrado
- **THEN** la respuesta no se anota y el bot avisa que ese día ya cerró

#### Scenario: Botón de un plan que ya no está en marcha
- **WHEN** el destinatario toca, desde su chat, un botón de un plan terminado o anulado
- **THEN** la respuesta no se anota y el bot avisa que ese mensaje es de un plan que ya no está en marcha

#### Scenario: Botón de un plan cerrado desde un chat ajeno
- **WHEN** alguien toca, desde un chat que no es el del destinatario, un botón de un plan terminado o anulado
- **THEN** la respuesta no se anota y el bot da el aviso genérico, sin decir por qué
