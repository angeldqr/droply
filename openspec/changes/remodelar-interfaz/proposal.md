# Proposal

## Why

La web funciona, pero el cliente quiere otra cara: una estética oscura con acento menta, letra nueva,
animaciones más cuidadas y componentes más ricos. Además hay listas que crecen sin fin y hoy se
traen enteras, y el historial de envíos corta en 50 sin forma de ver más atrás.

## What Changes

- Paleta nueva: fondo verde muy pálido, paneles blancos, texto y botón principal en negro, y
  acento menta. Reemplaza al morado en toda la app. Sigue habiendo un solo tema, claro.
- Tipografía nueva: DM Sans para todo y DM Mono para cifras, fechas y horas.
- Esquinas más redondas y botones en forma de píldora.
- Una tarjeta "firma" con degradado menta y grano, una por pantalla, para lo más importante.
- Componentes nuevos instalados por CLI desde el registro de Aceternity UI y desde shadcn, usados
  en la portada, la navegación, las tarjetas, las pestañas, la bitácora, el tablero y el asistente.
- Navegación del celular con una barra flotante abajo.
- Distribución nueva: el título de cada pantalla y sus acciones van en la barra de arriba, y el
  contenido se arma con paneles redondos pegados, con una fila de cifras sobre cada lista.
- Pantalla de inicio nueva, a la que se llega al entrar: saludo y resumen del día.
- Portada y pantalla de entrar nuevas, en cuadrícula tipo bento sobre negro.
- El asistente pasa a ser una tarjeta de degradado menta que crece desde su botón.
- Los diálogos crecen desde el botón que los abre, sin oscurecer la página, y su contenido entra
  con desenfoque. Los botones se aplastan al presionarlos.
- Un solo componente para los estados "cargando", "error" y "vacío" de las listas.
- Buscador de zona horaria en Mi cuenta, en vez de una lista de 400 opciones.
- Paginación:
  - Historial de envíos: por páginas, desde el servidor. Se puede ver todo el historial.
  - Cuentas del panel de administración: por páginas, desde el servidor.
  - Anotaciones de un hábito, planes terminados y columnas del tablero y del baúl: se muestran por
    partes en la web, con "Ver más" o páginas.

Fuera de alcance:

- Tema oscuro.
- Finanzas con Telegram: va en un cambio aparte, `agregar-finanzas`.
- Buscadores y filtros en las listas.
- Bloques de pago de Aceternity.
- Partir en el servidor las anotaciones de un hábito, los elementos de una biblioteca o los planes.
- Cambios en el bot de Telegram o en lo que se envía.

## Capabilities

### New Capabilities

- `interface`: cómo se presenta la web a la persona: la pantalla de inicio, y cómo se recorren las
  listas largas (historial de envíos, cuentas, anotaciones, planes terminados y columnas del tablero).

### Modified Capabilities

Ninguna. Los requisitos de `habits` y `assistant` no cambian.

## Impact

- `packages/contracts`: archivo nuevo de paginación (parámetros de página y forma de la respuesta).
  Cambia la respuesta de `GET /deliveries` y de `GET /admin/accounts`: de un arreglo a un objeto con
  `items`, `total`, `page` y `pageSize`.
- `prisma/schema.prisma`: no se toca.
- `apps/api`: contextos `delivery` y `admin` (controlador, puerto y adaptador Prisma).
- `apps/web`: tokens, hoja de estilos global, fuentes, proveedor de tema, armazón, todas las páginas
  y componentes propios, y los componentes nuevos en `components/ui`.
- `packages/ui`: `tokens.css`.
- `openspec/config.yaml`: la regla de componentes por CLI y la de colores.
- La guía del asistente: menciona la pantalla de inicio y el historial de envíos por páginas.
- Dependencias nuevas de la web: las que traiga cada componente instalado por CLI.
