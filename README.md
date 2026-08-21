# droply

Arma bibliotecas de audios, videos, imágenes y textos, y deja que un bot envíe uno al azar a quien indiques, en el horario que elijas.

## Cómo levantarlo

Necesitas Node 22 o superior, pnpm y Docker.

```bash
pnpm install
```

Copia el archivo de ejemplo y completa los valores:

```bash
cp .env.example .env
```

Los secretos se generan así:

```bash
openssl rand -base64 48
```

`ENCRYPTION_KEY` es el único que va con 32 bytes en vez de 48:

```bash
openssl rand -base64 32
```

El token del bot lo entrega [@BotFather](https://t.me/BotFather) con `/newbot`.

Necesitas Postgres 18 en ejecución, alcanzable desde la URL que configuraste en el `.env`.

El almacenamiento compatible con S3 lo da el binario de [MinIO](https://dl.min.io/server/minio/release/windows-amd64/minio.exe), y **no hace falta lanzarlo a mano**: `pnpm --filter @droply/api dev` lo levanta suelto antes de arrancar, crea el bucket si falta y no lo vuelve a tocar. Deja el binario en `.tools/minio.exe` dentro del repositorio o en `%USERPROFILE%\minio\minio.exe`, o apunta a él con `MINIO_BINARY` en el `.env`. Para levantarlo por separado: `pnpm run dev:storage`.

La consola de administración queda en http://localhost:9001. El bucket se llama como diga `STORAGE_BUCKET` y se deja privado: el contenido solo sale por URL firmada.

El bot de Telegram lo crea [@BotFather](https://t.me/BotFather) con `/newbot`; su token y su
usuario van en `TELEGRAM_BOT_TOKEN` y `TELEGRAM_BOT_USERNAME`.

Telegram no puede alcanzar una dirección local, así que en desarrollo el API **no** registra
webhook: abre una conexión larga contra `getUpdates` y espera los mensajes. En el servidor basta
con poner `TELEGRAM_WEBHOOK_URL` apuntando a `<API_URL>/api/telegram/webhook` y el arranque
registra el webhook solo, con el secreto de `TELEGRAM_WEBHOOK_SECRET`.

Docker no hace falta en desarrollo, solo para el despliegue.

Crea la base y el rol una sola vez, tomando la contraseña del propio `.env` para no escribirla en ningún lado:

```bash
psql -U postgres -h 127.0.0.1 -v pw="$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)" -c "CREATE ROLE droply LOGIN PASSWORD :'pw';" -c "CREATE DATABASE droply OWNER droply;"
```

Después:

```bash
pnpm dev
```

| Servicio | Dónde                 |
| -------- | --------------------- |
| Web      | http://localhost:3000 |
| API      | http://localhost:3001 |

## Estructura

```
apps/
  api/        HTTP, autenticación, webhook de Telegram, latido de envíos
  web/        interfaz
packages/
  contracts/  esquemas Zod compartidos entre api y web
  ui/         tokens de diseño
  tooling/    tsconfig y reglas de ESLint
infra/        compose y Dockerfile para el deploy
```

Dentro de `apps/api/src` cada carpeta es un contexto del negocio (`libraries`, `scheduling`, `delivery`…) y dentro de cada uno están las cuatro capas: `domain`, `application`, `infrastructure` y `presentation`.

Las dependencias apuntan siempre hacia adentro, y eso no depende de la buena voluntad de nadie: `eslint-plugin-boundaries` lo verifica en cada `pnpm lint`. Si el dominio importa Prisma o un contexto mete mano en el dominio de otro, el build falla.

## Comandos

| Comando             | Qué hace                                   |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | Levanta las tres apps en modo desarrollo   |
| `pnpm lint`         | ESLint, incluidas las fronteras de capas   |
| `pnpm typecheck`    | Chequeo de tipos sin emitir                |
| `pnpm test`         | Tests unitarios                            |
| `pnpm build`        | Build de producción                        |
| `pnpm secrets:scan` | Busca secretos filtrados en el repositorio |

## Deploy

En la máquina virtual todo corre con Docker Compose. Un solo `Dockerfile` con tres destinos construye las tres apps.

```bash
docker compose --env-file .env -f infra/compose.yml --profile apps up -d --build
```

Solo se publican al exterior los puertos que un navegador necesita alcanzar: la web, el API y el puerto S3 del almacenamiento. Postgres y la consola de administración quedan atados a `127.0.0.1`, así que para entrar hay que pasar por un túnel SSH.

Falta poner un proxy inverso con TLS delante. Hoy los tres puertos públicos hablan HTTP en claro.

## Secretos

El `.env` no se commitea nunca. Hay un hook de `pre-commit` con [gitleaks](https://github.com/gitleaks/gitleaks) que revisa lo que estás por subir y corta el commit si encuentra algo que parezca una clave.

Se instala con:

```bash
winget install gitleaks
```

Si falta una variable de entorno, la app no arranca: el esquema de `packages/contracts/src/env` corta el proceso con el nombre de lo que falta.
