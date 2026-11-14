# Spec Delta

## ADDED Requirements

### Requirement: Preguntas desde Telegram
En un chat conectado a una cuenta, `/preguntar <pregunta>` SHALL responder en el chat con el mismo
asistente de la web: solo los datos de esa cuenta, solo lectura y tema cerrado. Cada pregunta SHALL
ir sola, sin las anteriores, y MUST NOT pasar de 2.000 caracteres. Mientras se responde, el chat
SHALL mostrar que el bot está escribiendo.

#### Scenario: Pregunta en el mismo mensaje
- **WHEN** Ana escribe en su chat conectado `/preguntar ¿cómo voy en mi plan?`
- **THEN** el bot responde con lo que lee de los planes de Ana, y de nadie más

#### Scenario: Le piden una acción
- **WHEN** Ana escribe `/preguntar anula mi plan`
- **THEN** el plan sigue igual y el bot explica cómo anularlo desde Yo en 30 días

#### Scenario: Pregunta demasiado larga
- **WHEN** la pregunta pasa de 2.000 caracteres
- **THEN** el bot pide una pregunta más corta y no llama al modelo

### Requirement: Pregunta en dos mensajes
Si el dueño de un chat conectado manda `/preguntar` sin texto, el bot SHALL contestar "¿Qué quieres
saber?" y tomar el mensaje de texto siguiente como la pregunta, si llega dentro de 5 minutos. Ese
mensaje MUST NOT guardarse como nota de una anotación. Pasado ese tiempo, el mensaje se trata como
cualquier otro.

#### Scenario: Pregunta después del comando
- **WHEN** Ana escribe `/preguntar` y después "¿cuál es mi racha?"
- **THEN** el bot responde la racha de Ana y no guarda ese texto en ninguna anotación

#### Scenario: Llega tarde
- **WHEN** Ana escribe `/preguntar` y manda otro texto 10 minutos después
- **THEN** ese texto no se toma como pregunta

## MODIFIED Requirements

### Requirement: Límites de uso
El sistema SHALL permitir como mucho 15 preguntas por día a cada cuenta, sumando la web y Telegram, y 10 por minuto desde una
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

#### Scenario: El tope se comparte con Telegram
- **WHEN** una cuenta hizo 15 preguntas en la web y escribe `/preguntar` en Telegram
- **THEN** el bot responde "Ya hiciste las 15 preguntas de hoy. Vuelve mañana." y el modelo no se llama

#### Scenario: Cuota del proveedor desde Telegram
- **WHEN** el proveedor agota su cuota mientras responde una pregunta de Telegram
- **THEN** el bot responde "El asistente llegó a su límite por hoy. Vuelve mañana."
