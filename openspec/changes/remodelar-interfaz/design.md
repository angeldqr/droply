# Design

## Context

- Casi toda la web usa las variables semánticas de shadcn (`bg-card`, `text-muted-foreground`,
  `bg-sidebar`…). Se definen en `apps/web/src/app/globals.css` a partir de los tokens de
  `packages/ui/src/tokens.css`.
- Unas 70 clases en 12 archivos usan la paleta de marca por nombre (`ciruela`, `morado`, `lavanda`,
  `papel`, `logro`, `medias`, `alerta`). La mayor concentración está en
  `components/connect-telegram-card.tsx` y en los gráficos de hábitos.
- `globals.css` declara la variante `dark` pero no tiene bloque `.dark`. `next-themes` está instalado
  sin proveedor.
- El registro `@aceternity` ya está en `apps/web/components.json`. `ui/sidebar.tsx` y
  `ui/file-upload.tsx` ya vienen de ahí.
- Los componentes de Aceternity traen colores fijos (`neutral-*`, `bg-white`, `dark:bg-black`).
- Ningún endpoint de lista pagina. `GET /deliveries` corta en 50. El asistente usa el mismo puerto
  con su propio límite.
- En el detalle de un hábito, el calendario, el año, la tendencia y la racha se calculan en la web
  con todas las anotaciones.

## Goals / Non-Goals

**Goals:**

- Que cambiar la paleta sea cambiar tokens, no clases sueltas: al terminar no queda ninguna clase
  con el nombre de un color de marca viejo.
- Los dos temas salen de las mismas variables semánticas.
- Un solo lugar para la curva y la duración de las animaciones.
- Paginar en el servidor solo donde hoy hay un problema real.

**Non-Goals:**

- No se cambia el modelo de datos ni se agregan migraciones.
- No se reescribe la lógica de los gráficos de hábitos; solo sus colores.
- No se reemplaza el morph de los diálogos (Blendy).

## Decisions

### Tokens con nombre de papel, no de color

Los tokens nuevos de `tokens.css` son: `fondo`, `tarjeta`, `tinta`, `apagado`, `menta`,
`aguamarina`, `logro`, `ambar`, `coral`, `violeta`, y `sobre` (el texto que va encima de un relleno
de estado: negro en oscuro, blanco en claro). Cada uno tiene valor para oscuro y para claro.

| Token | Oscuro | Claro |
|---|---|---|
| `fondo` | `#000000` | `#EEF8EC` |
| `tarjeta` | `#101012` | `#FFFFFF` |
| `tinta` | `#E4E2E5` | `#17201B` |
| `apagado` | `#7E8088` | `#5F6B64` |
| `menta` | `#3DF58A` | `#3DF58A` |
| `logro` | `#3DF58A` | `#14854D` |
| `aguamarina` | `#7FEAD2` | `#7FEAD2` |
| `ambar` | `#F5B544` | `#B87A12` |
| `coral` | `#FF5C6C` | `#C8324A` |
| `violeta` | `#B07CF0` | `#7A3FD0` |

Las variables de shadcn se asignan así: `--primary` es `menta` con texto negro; `--background`,
`--card`, `--foreground` y `--muted-foreground` salen de los cuatro primeros; `--destructive` es
`coral`; el menú lateral usa `tarjeta`. `primary` es siempre relleno: como texto
de acento se usa `logro`, que en claro es un verde oscuro legible. Los estados de hábitos: cumplido es `logro`, a medias es
`ambar`, no cumplido es `coral`. Las columnas del tablero tienen cuatro
rellenos claros fijos (aguamarina, menta, ámbar y violeta) con tinta negra en los dos temas.

Alternativa descartada: conservar los nombres `morado`, `lavanda`… con valores nuevos. Deja nombres
que mienten.

### Tema con `next-themes` y clase `.dark`

`ThemeProvider` en `app/providers.tsx` con `attribute="class"`, `defaultTheme="dark"` y
`enableSystem={false}`. `:root` lleva el tema claro y `.dark` el oscuro, que es la convención de
shadcn y hace que las clases `dark:` de los componentes instalados funcionen sin tocarlas. El botón
va en el menú de usuario del armazón.

Alternativa descartada: seguir el tema del sistema. El cliente pidió oscuro por defecto.

### Tipografía

DM Sans (`--font-sans` y `--font-display`) y DM Mono (`--font-mono`) con `next/font`. Los títulos
van en peso 500, espaciado −0.03em e interlineado 0.95. Las cifras, fechas y horas usan
`font-mono tabular-nums`.

### Forma y firma

`--radius` pasa a `1rem`. Las tarjetas usan `rounded-4xl`. Botones e insignias en píldora.

La tarjeta firma es un componente propio, `components/signature-card.tsx`, que envuelve
`noise-background` con el degradado `menta` → `aguamarina`. Regla: una por pantalla.

### Movimiento

Dos variables en `tokens.css`, `--ease-salida` y `--duracion`, y sus equivalentes en un módulo
`lib/motion.ts` para `motion/react`. `MotionList` se sigue usando para la entrada de listas. La regla
global de `prefers-reduced-motion` se conserva.

### Componentes de Aceternity: instalar, y después teñir

Se instalan con `pnpm dlx shadcn@latest add @aceternity/<slug> -c apps/web`. Después de instalar, en
el mismo commit, se cambian sus colores fijos por las variables semánticas. No se editan a mano más
allá de eso y de textos en español.

Lista y destino en `tasks.md`. Si un componente no compila con React 19 o Tailwind v4, o pesa
demasiado para lo que aporta, se deja fuera y se anota en la tarea.

### Estados de lista

`components/list-state.tsx` recibe la consulta de TanStack Query y tres piezas: el esqueleto, el
título del error y el contenido del estado vacío. Reemplaza el ternario repetido en seis páginas.

### Paginación en el servidor: por número de página

`packages/contracts/src/pagination.ts`:

- `pageQuerySchema`: `page` entero ≥ 1 (por defecto 1), `pageSize` entero de 1 a 50 (por defecto 20).
- `paged(item)`: `{ items, total, page, pageSize }`.

`GET /deliveries` y `GET /admin/accounts` validan la consulta con ese esquema y responden con esa
forma. En Prisma: `skip`, `take` y un `count` con el mismo `where`. El puerto de envíos gana un
método `page`; `recent` queda para el asistente.

Alternativa descartada: cursor. El historial se recorre poco y el cliente quiere ver "página 2 de
5"; con número de página el total sale gratis y la tabla es más simple.

### Paginación en la web: recortar lo que ya llegó

Para anotaciones, planes terminados y columnas del tablero, un hook `lib/use-shown.ts` devuelve los
primeros N y una función para mostrar más. Los resúmenes siguen usando la lista entera.

Alternativa descartada: partir las anotaciones en el servidor. Pide un endpoint aparte para los
conteos por día; no se justifica hasta que una cuenta tenga miles.

### Segunda vuelta: un solo tema claro, y la distribución de Melon Mind

Después de ver la primera versión el cliente eligió **un solo tema, claro, con detalles negros**, y
trajo Melon Mind como referencia de distribución y animaciones. Esta sección manda sobre lo que diga
arriba cuando se contradigan.

- **Tema.** Se quitan `.dark`, `next-themes` como proveedor y el botón de cambiar. Fondo `#EEF8EC`,
  paneles blancos, tinta y botón principal `#0B0F0D` con blanco encima. La menta deja de ser el
  botón principal y queda de acento: la entrada activa del menú, lo cumplido y el asistente. El
  negro lleno aparece en los botones principales, la portada y la pantalla de entrar.
- **Movimiento.** Curva base `cubic-bezier(.38,.49,0,1)`; con rebote `(.38,.49,0,1.1)` para lo que
  aparece. Lo que entra lo hace con fundido, desenfoque y escala (`blur 16px`, `scale .96`). Los
  botones se aplastan al presionar. Las cifras que cambian ruedan.
- **Diálogos.** Siguen con Blendy, pero el velo ya no oscurece: es casi transparente con un
  desenfoque leve. Al terminar de crecer, el contenido entra escalonado con desenfoque.
- **Asistente.** Es la tarjeta firma (menta, dos manchas en órbita, grano) y se abre con el mismo
  morph de Blendy desde su botón. Sin encabezado: botones redondos de vidrio y texto grande. Con
  esto la firma vive en el asistente, que está en todas las pantallas, y no se repite en otras
  tarjetas: lo importante de cada pantalla va en un panel relleno, sin degradado.
- **Distribución.** `AppShell` recibe `title` y `actions`. El contenido se arma con `Panel` (radio
  grande, borde fino, 8 px entre paneles, uno relleno por pantalla) y `StatRow` (fila de cifras).
  Los estados vacíos pierden la caja.
- **Inicio.** `app/inicio/page.tsx`, armada con consultas que ya existen. No toca la API.

Alternativa descartada: formularios anclados junto al botón que los abre, como en Melon Mind. Radix
centra el diálogo y Blendy calcula el morph contra esa posición; anclarlos pide reescribir los dos.
Se conserva el centro y se gana el resto (sin velo oscuro, contenido que entra, botón que vuelve).

## Risks / Trade-offs

- [El menta sobre fondo claro no da contraste como texto] → `menta` se usa solo como fondo con texto
  negro encima; para texto de acento en claro se usa `tinta`.
- [Componentes de Aceternity con mucho JavaScript en el celular] → los de fondo animado solo en la
  portada; `prefers-reduced-motion` los apaga.
- [Destello del tema equivocado al cargar] → `next-themes` inyecta su script antes de pintar;
  `suppressHydrationWarning` en `<html>`.
- [Cambia la forma de dos respuestas de la API] → la web y la API se despliegan juntas; no hay otros
  clientes.
- [Con las anotaciones recortadas en la web, la descarga sigue siendo completa] → aceptado; queda
  anotado en el código con su techo.

## Migration Plan

Sin migraciones de base. Se despliega como siempre: respaldo, `git pull`, compose con
`--profile apps`. Para volver atrás, `git revert` de los commits del cambio y redesplegar.
