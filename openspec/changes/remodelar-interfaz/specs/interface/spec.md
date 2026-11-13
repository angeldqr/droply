# Spec Delta

## Purpose

Describe cómo se presenta la web a la persona: la pantalla a la que llega al entrar y cómo recorre
las listas que pueden crecer mucho, sin traerlas enteras ni perder acceso a lo más viejo.

## ADDED Requirements

### Requirement: Pantalla de inicio

Al iniciar sesión, la persona SHALL llegar a una pantalla de inicio que la salude por su nombre y
resuma el día: cuántos de sus hábitos de la bitácora lleva hechos hoy, su plan de hábitos en marcha,
los envíos programados para hoy, sus últimos envíos y sus avisos sin leer. Cada resumen SHALL llevar
a su sección. Cuando un resumen no tiene datos, la pantalla SHALL decirlo en una línea en vez de
dejar el espacio en blanco. La pantalla MUST mostrar solo datos de la cuenta que la abre.

#### Scenario: Entrar a la aplicación

- **WHEN** la persona inicia sesión
- **THEN** llega a la pantalla de inicio y ve su nombre en el saludo

#### Scenario: Día con hábitos

- **WHEN** la persona tiene 3 hábitos que aplican hoy y ya hizo 1
- **THEN** el inicio dice que lleva 1 de 3

#### Scenario: Cuenta recién creada

- **WHEN** la cuenta no tiene hábitos, planes, horarios ni envíos
- **THEN** cada resumen dice que todavía no hay nada y ofrece ir a su sección

#### Scenario: Ir a una sección

- **WHEN** la persona elige el resumen de su plan en marcha
- **THEN** llega al detalle de ese plan

### Requirement: Texto legible

El texto y los controles SHALL tener contraste suficiente para leerse, y el elemento que tiene el
foco del teclado SHALL verse.

#### Scenario: Recorrer con el teclado

- **WHEN** la persona avanza por una pantalla con la tecla Tab
- **THEN** el control que tiene el foco se distingue de los demás

### Requirement: Movimiento reducido

Cuando el dispositivo pide reducir el movimiento, la web SHALL mostrar el contenido sin animaciones
de entrada, de salida ni de fondo. Los indicadores de carga MAY seguir girando.

#### Scenario: Dispositivo con movimiento reducido

- **WHEN** el dispositivo tiene activada la preferencia de reducir movimiento y la persona abre una pantalla
- **THEN** el contenido aparece en su lugar final sin animarse

### Requirement: Historial de envíos por páginas

La API SHALL entregar el historial de envíos del dueño por páginas, del más reciente al más viejo,
junto con el total de envíos. El tamaño de página SHALL ser de 20 por defecto y de 50 como máximo.
La API MUST entregar solo los envíos de la cuenta que pregunta. La web SHALL permitir pasar de una
página a otra hasta el envío más viejo.

#### Scenario: Primera página

- **WHEN** una cuenta con 45 envíos pide el historial sin indicar página
- **THEN** recibe los 20 más recientes, el total 45, la página 1 y el tamaño 20

#### Scenario: Última página

- **WHEN** esa cuenta pide la página 3
- **THEN** recibe los 5 envíos más viejos y el total 45

#### Scenario: Página que no existe

- **WHEN** esa cuenta pide la página 9
- **THEN** recibe una lista vacía y el total 45

#### Scenario: Parámetros fuera de rango

- **WHEN** alguien pide la página 0 o un tamaño de página de 500
- **THEN** la API rechaza el pedido como inválido

#### Scenario: Envíos de otra cuenta

- **WHEN** dos cuentas tienen envíos y una pide su historial
- **THEN** ni la lista ni el total incluyen envíos de la otra

### Requirement: Cuentas del panel de administración por páginas

La API SHALL entregar la lista de cuentas del panel de administración por páginas, en el orden en
que se crearon, junto con el total de cuentas, con el mismo tamaño de página que el historial de
envíos. Solo un administrador MUST poder pedirla. La web SHALL permitir pasar de una página a otra.

#### Scenario: Más cuentas que una página

- **WHEN** hay 30 cuentas y un administrador abre el panel
- **THEN** ve las 20 primeras y puede pasar a la página 2, que tiene las 10 restantes

#### Scenario: Quien no es administrador

- **WHEN** una cuenta sin permiso de administrador pide la lista de cuentas
- **THEN** la API la rechaza igual que antes de este cambio

### Requirement: Listas largas mostradas por partes

La web SHALL mostrar por partes las listas que no tienen tope: las anotaciones de un hábito, los
planes terminados y cada columna del tablero de una biblioteca y del baúl. La persona SHALL poder
pedir la parte siguiente hasta ver la lista completa. Los resúmenes que dependen de la lista entera
(el calendario, el año, la tendencia y la racha de un hábito, y los contadores de cada columna)
SHALL seguir calculándose con todos los datos y no solo con la parte visible.

#### Scenario: Hábito con muchas anotaciones

- **WHEN** la persona abre un hábito con anotaciones en 40 días distintos
- **THEN** ve los 10 días más recientes y un control para ver más
- **AND** el calendario y la racha cuentan los 40 días

#### Scenario: Ver más anotaciones

- **WHEN** la persona pide ver más
- **THEN** se agregan los 10 días siguientes debajo de los que ya veía

#### Scenario: Columna larga del tablero

- **WHEN** una columna del tablero tiene 80 elementos
- **THEN** la columna muestra 30, un control para ver más, y su contador dice 80

#### Scenario: Lista corta

- **WHEN** una lista cabe entera en la primera parte
- **THEN** no aparece ningún control de páginas ni de "ver más"

### Requirement: Estados de una lista

Toda pantalla que muestra una lista SHALL distinguir tres estados además de la lista con datos:
cargando, error y vacía. El estado de error SHALL decir qué no se pudo cargar. El estado vacío SHALL
decir qué falta y, cuando la persona puede crear el primer elemento desde ahí, ofrecer esa acción.

#### Scenario: Lista vacía

- **WHEN** la persona abre una lista en la que todavía no tiene nada
- **THEN** ve un mensaje que explica qué va ahí y el botón para crear el primero

#### Scenario: Falla al cargar

- **WHEN** la lista no se puede cargar
- **THEN** la persona ve un mensaje de error que nombra esa lista, y no una pantalla en blanco
