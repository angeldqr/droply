# Spec Delta

## MODIFIED Requirements

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
- **WHEN** el dueño abre "Nuevo plan" y elige a Ana como destinatario
- **THEN** la pantalla deshabilita solo las bibliotecas que ya están en un plan vivo hacia Ana, con el
  texto "Ya es un hábito de «plan»", y deja elegir las que están en planes hacia otras personas

#### Scenario: Cambiar de destinatario en la pantalla
- **WHEN** el dueño marca una biblioteca y después cambia a un destinatario para el que esa biblioteca
  ya está en un plan vivo
- **THEN** la biblioteca se desmarca y queda deshabilitada

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
