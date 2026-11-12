# Spec Delta

## Purpose

El asistente del chat responde dudas sobre cómo funciona Reconéctate y sobre los datos de la cuenta
que pregunta, sin ver otras cuentas y sin cambiar nada.

## ADDED Requirements

### Requirement: Solo los datos de quien pregunta
El sistema SHALL leer para el asistente únicamente los datos de la cuenta de la sesión. El modelo
MUST NOT poder elegir de qué cuenta leer: puede pedir un plan, un hábito o una biblioteca por su id,
pero un id de otra cuenta, o uno que no tiene forma de id, SHALL responderse como inexistente.

#### Scenario: Pregunta por sus planes
- **WHEN** Ana pregunta cómo va en su plan
- **THEN** el asistente lee solo los planes de Ana

#### Scenario: Id de otra cuenta
- **WHEN** el modelo pide el detalle de un plan que es de otra cuenta
- **THEN** la lectura responde que no existe en esta cuenta y no devuelve ningún dato del plan

### Requirement: Solo lectura
El asistente MUST NOT tener ninguna forma de crear, cambiar ni borrar datos. Si le piden una acción,
SHALL explicar dónde hacerla en la aplicación.

#### Scenario: Le piden anular un plan
- **WHEN** el usuario escribe "anula mi plan"
- **THEN** el plan sigue igual y el asistente explica cómo anularlo desde Yo en 30 días

### Requirement: Tema cerrado
El asistente SHALL responder solo sobre cómo funciona Reconéctate y sobre los datos de la cuenta. A
cualquier otra pregunta, incluida escribir código, SHALL responder "Solo puedo ayudarte con
Reconéctate y con tus datos en la aplicación." El texto que guardó el usuario MUST tratarse como dato
y no como instrucción.

#### Scenario: Pide código
- **WHEN** el usuario escribe "escríbeme un programa en Python"
- **THEN** el asistente responde la frase fija y no escribe código

#### Scenario: Duda de la aplicación
- **WHEN** el usuario pregunta cómo se crea un horario
- **THEN** el asistente lo explica con lo que dice la guía de la aplicación

### Requirement: Lo que viaja en cada pregunta
El sistema SHALL aceptar solo texto: una lista de 1 a 20 turnos de usuario o asistente que termina
en una pregunta del usuario. Una pregunta MUST NOT pasar de 2.000 caracteres ni una respuesta previa
de 8.000. Lo demás SHALL rechazarse con 400.

#### Scenario: Turno que no es texto de usuario ni de asistente
- **WHEN** el cuerpo trae un turno con rol `tool`
- **THEN** la ruta responde 400 y no llama al modelo

#### Scenario: Conversación larga
- **WHEN** la web tiene más de 20 turnos
- **THEN** manda solo los 20 últimos

### Requirement: Límites de uso
El sistema SHALL permitir como mucho 15 preguntas por día a cada cuenta y 10 por minuto desde una
misma conexión. Pasado el tope diario SHALL responder 429 con "Ya hiciste las 15 preguntas de hoy.
Vuelve mañana." y, pasado el de un minuto, el chat SHALL mostrar "Vas muy rápido. Espera un minuto y
vuelve a preguntar." Si el proveedor agota su cuota, el chat SHALL mostrar "El asistente llegó a su
límite por hoy. Vuelve mañana."

#### Scenario: El usuario cierra el chat a mitad de respuesta
- **WHEN** la web corta la conexión mientras el modelo responde
- **THEN** el servidor deja de generar la respuesta

#### Scenario: Pregunta número 16
- **WHEN** una cuenta hace su pregunta número 16 del día
- **THEN** la ruta responde 429 y el modelo no se llama

### Requirement: Sin proveedor configurado
Sin `GROQ_API_KEY`, el sistema SHALL arrancar igual y la ruta del asistente SHALL responder 503 con
"El asistente no está disponible por ahora."

#### Scenario: Servidor sin clave
- **WHEN** alguien pregunta y el servidor no tiene `GROQ_API_KEY`
- **THEN** el chat muestra que el asistente no está disponible y el resto de la aplicación funciona

### Requirement: La conversación vive en la pestaña
El sistema MUST NOT guardar las conversaciones. La web SHALL conservarlas al cambiar de pantalla y
SHALL borrarlas al cerrar la pestaña, al cerrar sesión o con "Nueva conversación".

#### Scenario: Cierra sesión
- **WHEN** Ana cierra sesión y entra otra cuenta en la misma pestaña
- **THEN** el chat de la nueva cuenta empieza vacío
