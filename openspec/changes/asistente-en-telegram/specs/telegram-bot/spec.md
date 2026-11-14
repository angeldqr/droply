# Spec Delta

## Purpose

Lo que el bot de Telegram ofrece en el chat: sus comandos en español, la ayuda para dar los primeros
pasos y qué contesta según quién le escribe.

## ADDED Requirements

### Requirement: Comandos en español
El bot SHALL nombrar y publicar en su menú solo comandos en español: `/habitos`, `/hoy`, `/fin`,
`/ayuda` y `/preguntar`, cada uno con su descripción. SHALL seguir atendiendo `/habits` como el
nombre viejo de `/habitos`, sin publicarlo ni nombrarlo en ningún texto. `/start` SHALL quedarse con
ese nombre, porque es el que mandan los enlaces de invitación.

#### Scenario: Menú del bot
- **WHEN** alguien abre el menú de comandos del bot
- **THEN** ve `habitos`, `hoy`, `fin`, `ayuda` y `preguntar`, y ninguno en inglés

#### Scenario: Nombre viejo
- **WHEN** el dueño de un chat conectado escribe `/habits`
- **THEN** el bot le muestra la lista de hábitos, igual que con `/habitos`

### Requirement: Ayuda para el dueño de una cuenta
En un chat conectado a una cuenta, `/ayuda` SHALL responder con los primeros pasos en la aplicación
(una biblioteca, un destinatario, un horario), cómo anotar con `/habitos`, `/hoy` y `/fin`, y que
puede preguntar con `/preguntar`. SHALL hacerlo sin cerrar ni cambiar una anotación abierta.

#### Scenario: Pide ayuda desde su chat
- **WHEN** Ana, con su chat conectado desde Mi bitácora, escribe `/ayuda`
- **THEN** el bot le explica los primeros pasos y los comandos, incluido `/preguntar`

#### Scenario: Pide ayuda con una anotación abierta
- **WHEN** Ana tiene una anotación abierta y escribe `/ayuda`
- **THEN** el bot responde la ayuda, la anotación sigue abierta y `/ayuda` no queda guardado como nota

### Requirement: Ayuda para los demás chats
En un chat que no está conectado a una cuenta, `/ayuda` SHALL explicar cómo llegan los envíos, qué
significan los botones Realizado, 50% y No cumplido de un plan, y cómo conecta su chat quien sí tiene
cuenta. MUST NOT nombrar `/preguntar` como algo que ese chat pueda usar.

#### Scenario: Un destinatario pide ayuda
- **WHEN** un destinatario escribe `/ayuda`
- **THEN** el bot le explica los envíos y los botones del plan, sin datos de ninguna cuenta

### Requirement: Preguntar sin cuenta
En un chat que no está conectado a una cuenta, `/preguntar` SHALL responder que las preguntas son
para quien tiene cuenta en Reconéctate y sugerir `/ayuda`, sin llamar al asistente.

#### Scenario: Un destinatario intenta preguntar
- **WHEN** un destinatario escribe `/preguntar cómo voy`
- **THEN** el bot le dice que las preguntas son para quien tiene cuenta, le sugiere `/ayuda` y no se gasta ninguna pregunta del día
