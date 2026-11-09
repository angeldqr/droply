# Spec Delta

## MODIFIED Requirements

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
