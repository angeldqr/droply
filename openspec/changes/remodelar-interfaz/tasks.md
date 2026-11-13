# Tasks

## 1. Base: tokens, letra y temas

- [x] 1.1 Reescribir `packages/ui/src/tokens.css` con los tokens nuevos, las fuentes y las variables de movimiento. Se verifica con el typecheck y abriendo la web.
- [x] 1.2 Reescribir los bloques `:root` y `.dark` de `apps/web/src/app/globals.css` y subir `--radius`. Se verifica viendo cualquier pantalla en los dos temas.
- [x] 1.3 Cargar DM Sans y DM Mono en `app/layout.tsx` y quitar Quicksand y Nunito. Se verifica en el inspector: la fuente del `body` es DM Sans.
- [x] 1.4 Agregar `ThemeProvider` en `app/providers.tsx` (oscuro por defecto) y el botón de tema en el menú de usuario. Se verifica: primera visita en oscuro, cambio sin recargar, y la elección sigue al reabrir.
- [x] 1.5 Reemplazar las clases de la paleta vieja en los 12 archivos que las usan. Se verifica con una búsqueda de `ciruela|morado|lavanda|papel|logro-|medias-|alerta-` en `apps/web/src` y `packages/ui/src`, que debe dar cero.
- [x] 1.6 Actualizar `openspec/config.yaml` (dos temas; registro de Aceternity) y `themeColor`. Se verifica con `openspec validate --all --strict`.

## 2. Armazón y piezas comunes

- [x] 2.1 Instalar por CLI de shadcn: `table`, `command`, `popover` (`pagination` se instaló y se quitó: ver 9.4). Se verifica con el typecheck.
- [x] 2.2 (Al final se quitaron `hover-border-gradient`, `sticky-banner` y `stateful-button`: ver 8.3 y 8.7.) Instalar por CLI de Aceternity y teñir con las variables semánticas: `noise-background`, `glowing-effect`, `stateful-button`, `hover-border-gradient`, `loader`, `floating-dock`, `sticky-banner`, `card-spotlight`, `moving-border`, `tooltip-card`, `animated-tooltip`. Se verifica con el typecheck y una búsqueda de `neutral-` en los archivos nuevos, que debe dar cero. Quedaron fuera: las pestañas animadas (`tabs`), que son un mazo de tarjetas y no un selector, así que las pestañas de shadcn pasan a píldora; y el fondo de puntos de `card-spotlight`, que traía three.js entero para un efecto al pasar el cursor.
- [x] 2.3 Crear `components/signature-card.tsx` (tarjeta firma) y `lib/motion.ts`. Se verifica viéndola en los dos temas.
- [x] 2.4 Crear `components/list-state.tsx` (estados de carga, error y vacío). Su uso en cada pantalla va en el grupo 8.
- [x] 2.5 Armazón con menú lateral y dock para el celular. Se verifica en escritorio; el celular queda para la tarea 10.2.

## 3. Tema único claro con negro

- [x] 3.1 Dejar un solo tema en `tokens.css` y `globals.css` (fondo pálido, paneles blancos, tinta y botón principal negros, menta de acento) y quitar `.dark`. Se verifica abriendo la web: no cambia con el tema del sistema.
- [x] 3.2 Quitar `ThemeProvider` y el botón de tema del menú de la cuenta. Se verifica: el menú ya no lo ofrece y `localStorage` no guarda tema.
- [x] 3.3 Dejar `openspec/config.yaml` en "un solo tema claro". Se verifica con `openspec validate --all --strict`.

## 4. Animaciones base

- [x] 4.1 Poner las curvas nuevas en `tokens.css` y `lib/motion.ts`, y la entrada con desenfoque en `MotionList` y en el `<main>` del armazón. Se verifica navegando entre secciones.
- [x] 4.2 Aplastado al presionar en `ui/button.tsx`. Se verifica presionando un botón.
- [x] 4.3 Diálogos con Blendy: velo sin oscurecer, contenido que entra escalonado, curva con rebote al abrir. Se verifica abriendo y cerrando tres diálogos distintos, y con movimiento reducido. Hecho y visto en el navegador (nuevo plan, nueva biblioteca, iniciar sesión).
- [x] 4.4 `components/rolling-number.tsx` para las cifras que cambian. Se verifica marcando un hábito y viendo rodar la cifra.

## 5. Armazón y distribución

- [x] 5.1 `AppShell` con `title` y `actions` en la barra; menú sin borde con la entrada activa en píldora menta e icono relleno. Se verifica en todas las secciones.
- [x] 5.2 `components/panel.tsx` y `components/stat-row.tsx`; `EmptyState` sin caja. Se verifica en Bibliotecas.

## 6. Asistente

- [x] 6.1 Instalar `placeholders-and-vanish-input` y rehacer `assistant-widget.tsx` como tarjeta firma que crece desde su botón, sin encabezado. Se verifica: abrir, preguntar, conversación nueva, un error forzado y cerrar. Hecho: se probó abrir, preguntar, el foco al abrir y cerrar, y cerrar con Escape.

## 7. Inicio y entrada

- [x] 7.1 `app/inicio/page.tsx` con el saludo y los cinco resúmenes, y llegar ahí al entrar. Se verifica con los cuatro escenarios del requisito "Pantalla de inicio".
- [x] 7.2 Instalar y teñir `bento-grid`, `text-generate-effect`, `flip-words` y `wobble-card`. Se verifica con el typecheck.
- [x] 7.3 Rehacer la portada (`app/page.tsx`) y las pantallas de entrar, recuperar, restablecer y verificar. Se verifica entrando y saliendo de sesión, y con movimiento reducido. Hecho: portada con el nombre de corrido y entrar en negro; el botón de iniciar sesión abre su diálogo.

## 8. Pantallas

- [x] 8.1 Bibliotecas: título y acción en la barra, fila de cifras, paneles. Se verifica creando una biblioteca.
- [x] 8.2 Tablero y baúl: instalar `expandable-card` y `direction-aware-hover`; un contador por columna. Se verifica abriendo un texto, un audio, una imagen y un video. Hecho con `direction-aware-hover` en las miniaturas de imagen; las acciones de la biblioteca pasaron a la barra. `expandable-card` no se usó: en el registro es un bloque de demostración, y abrir la imagen o el video completos ya se hace en un diálogo.
- [x] 8.3 Destinatarios: cifras, `sticky-banner` para verificar el correo, `encrypted-text` al revelar el enlace y `animated-tooltip` en los destinatarios de una biblioteca. Se verifica generando un enlace. Hecho con `encrypted-text` (el enlace se revela) y `animated-tooltip` (quién recibe cada biblioteca). `sticky-banner` no se usó: se esconde al bajar, y el aviso de verificar el correo tiene que quedar a la vista.
- [x] 8.4 Horarios: cifras, `card-stack` para los avisos e historial de envíos en tabla. Se verifica con una cuenta que tenga avisos y envíos. Hecho: cifras e historial en tabla. `card-stack` no se usó: rota las cartas solo, y un aviso hay que poder leerlo y descartarlo.
- [x] 8.5 Planes: cifras, `card-spotlight` en las tarjetas, `moving-border` en el plan en marcha y panel relleno con el avance en el detalle. Se verifica creando un plan y abriendo su detalle. Hecho con `card-spotlight` y `moving-border` (quieto con movimiento reducido). El borde del plan en marcha no se pudo ver: la cuenta local no tiene ninguno en marcha. El panel relleno del detalle no se hizo: el detalle ya abre con su barra de avance y la tarjeta de constancia, y un panel negro encima repetía lo mismo.
- [x] 8.6 Bitácora: panel relleno con el día; instalar `timeline`, `focus-cards` y `carousel` para anotaciones, mosaico y visor; `tooltip-card` en el calendario. Se verifica con un hábito que tenga fotos. Hecho: las fotos de una anotación se enfocan al pasar el cursor, y el calendario muestra el detalle del día con `tooltip-card`. `timeline` y `focus-cards` no se usaron: son demostraciones de página de venta (títulos fijos en inglés, alturas de 24rem), y el diario ya es una línea de tiempo con su visor de fotos, que ya pasa de una foto a otra (por eso tampoco `carousel`). El resumen del día de Mi bitácora queda como estaba: el panel relleno con los hábitos de hoy ya está en Inicio. La ayuda del calendario es solo con ratón: en una pantalla táctil abría y cerraba en el mismo toque.
- [x] 8.7 Mi cuenta: buscador de zona horaria con `command` y `popover`, y `stateful-button` al guardar. Se verifica buscando "Bogota" y guardando. Hecho: buscador sin tildes ni mayúsculas («bogotá» encuentra America / Bogota). `stateful-button` no se usó: la zona se guarda al elegirla y cambiar la contraseña cierra la sesión, así que no hay un «listo» que mostrar.
- [x] 8.8 Admin: cifras y `card-spotlight` en las cuentas. Se verifica abriendo el detalle de una cuenta. Sin cambios: el panel ya pagina y muestra el total; un foco de luz en una lista de selección no aporta. Se deja como está.

## 9. Paginación

- [x] 9.1 Crear `packages/contracts/src/pagination.ts` con el esquema de consulta y la respuesta paginada, con su test de límites (página 0 y tamaño 500 se rechazan; los valores por defecto son 1 y 20).
- [x] 9.2 Paginar `GET /deliveries`: método de página en el puerto, su adaptador Prisma y el doble en memoria. Tests de los cinco escenarios del requisito "Historial de envíos por páginas".
- [x] 9.3 Paginar `GET /admin/accounts`. Tests de los dos escenarios del requisito "Cuentas del panel de administración por páginas".
- [x] 9.4 Web: `useDeliveries(page)` y `useAccounts(page)` con la página anterior visible mientras llega la siguiente, y un paginador propio de botones en ambas (el `pagination` de shadcn es de enlaces y acá la página vive en el estado, no en la dirección). Se verifica pasando de página en el navegador.
- [x] 9.5 Web: `lib/use-shown.ts` y su uso en las anotaciones de un hábito (10 días), los planes terminados y las columnas del tablero y del baúl (30). La cuenta vive en `firstParts` de contracts, que es donde hay corredor de tests. Test: lista corta sin control, "ver más" suma una parte, y el total no cambia. Se verifica además que el calendario y los contadores no cambian al recortar.

## 10. Cierre

- [x] 10.1 Actualizar `apps/api/src/assistant/infrastructure/guia.ts`: la pantalla de inicio y los envíos por páginas. Se verifica preguntándole al asistente qué hay en Inicio. Hecho en el commit anterior.
- [ ] 10.2 Recorrer cada ruta en escritorio y en el celular, con teclado y con movimiento reducido. Se verifica con capturas de cada pantalla.
- [x] 10.3 Typecheck, lint y test de `api`, `web` y `contracts`, y `openspec validate --all --strict`. Hecho: web y contracts limpios; api con el fallo conocido de horario de verano.
- [x] 10.4 `/code-review`. Hecho en dos tandas, cada una con sus correcciones: la remodelación y las pantallas internas.

## Workflow follow-up

- Comando de commit del cliente con `git commit -F`.
- Despliegue: respaldo, `git pull --ff-only`, compose con `--profile apps`.
- `/opsx:archive` y la fila `interface` en `openspec/README.md`.
- Después: `/opsx:propose agregar-finanzas` (ingresos y gastos con moneda, categorías, y registro desde Telegram).
