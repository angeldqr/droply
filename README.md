# Reconéctate

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

El almacenamiento compatible con S3 lo da el binario de [MinIO](https://dl.min.io/server/minio/release/windows-amd64/minio.exe), y **no hace falta lanzarlo a mano**: `pnpm --filter @reconectate/api dev` lo levanta suelto antes de arrancar, crea el bucket si falta y no lo vuelve a tocar. Deja el binario en `.tools/minio.exe` dentro del repositorio o en `%USERPROFILE%\minio\minio.exe`, o apunta a él con `MINIO_BINARY` en el `.env`. Para levantarlo por separado: `pnpm run dev:storage`.

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
psql -U postgres -h 127.0.0.1 -v pw="$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)" -c "CREATE ROLE reconectate LOGIN PASSWORD :'pw';" -c "CREATE DATABASE reconectate OWNER reconectate;"
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

En la máquina virtual todo corre con Docker Compose. Un solo `Dockerfile` con dos destinos construye las dos apps, y Caddy pone el TLS delante.

A la red pública sale **solo Caddy**, por el 80 y el 443. Postgres, MinIO y las dos apps quedan dentro de la red de compose; para entrar a Postgres o a la consola de MinIO hay que pasar por un túnel SSH.

### Antes del primer despliegue

**1. Tres nombres DNS apuntando a la máquina.** Tienen que colgar del mismo dominio registrable, porque la cookie de refresco sale con `sameSite=strict`:

| Nombre | Qué atiende |
| --- | --- |
| `reconecta.cloud` | la aplicación |
| `api.reconecta.cloud` | el API |
| `archivos.reconecta.cloud` | el almacenamiento |

El tercero no es un lujo: el navegador sube los archivos directo ahí, y una petición en claro desde una página HTTPS la bloquea el propio navegador.

**2. Swap.** Ese `--build` compila el front en la misma máquina que ya tiene Postgres y MinIO encima, y un `next build` se come más de dos gigas. Sin swap el despliegue muere a mitad sin decir por qué:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**3. El dominio verificado en Resend**, con los registros DNS que te da su panel. Sin eso los correos salen y no llegan.

**4. El `.env`**, copiado de `.env.example`. Los secretos se generan, no se inventan:

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET y TELEGRAM_WEBHOOK_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY (32 bytes exactos)
```

Y las URLs, que en producción no son las de desarrollo:

```
WEB_URL=https://reconecta.cloud
API_URL=https://api.reconecta.cloud
NEXT_PUBLIC_API_URL=https://api.reconecta.cloud
STORAGE_ENDPOINT=https://archivos.reconecta.cloud
TELEGRAM_WEBHOOK_URL=https://api.reconecta.cloud/api/telegram/webhook
MAIL_TRANSPORT=resend
WEB_DOMAIN=reconecta.cloud
API_DOMAIN=api.reconecta.cloud
STORAGE_DOMAIN=archivos.reconecta.cloud
```

`NEXT_PUBLIC_API_URL` la incrusta Next **al construir**, no al arrancar: cambiar de dominio obliga a reconstruir el front.

### Levantarlo

```bash
docker compose --env-file .env -f infra/compose.yml --profile apps up -d --build
```

Las migraciones corren solas al arrancar el API, antes que el servidor. Si fallan, el contenedor no arranca, que es lo correcto.

### Comprobar que quedó bien

En este orden, porque cada uno depende del anterior:

```bash
docker compose -f infra/compose.yml logs api | grep -i "prisma\|bot\|correo"
```

- **Que entra alguien.** Es lo que demuestra que `argon2` cargó. Si falla el login con un error del módulo nativo, es eso.
- **Que el bot dice `Bot escuchando por webhook`.** Si dice sondeo largo, falta `TELEGRAM_WEBHOOK_URL`.
- **Que el correo dice `salen por Resend`.** Si dice SMTP o `MAIL_TRANSPORT=log`, no va a llegar nada.
- **Subir una imagen.** Es lo que prueba de golpe el certificado del almacenamiento y que la firma cuadra con el dominio.

### La máquina es de 4 GB y un núcleo

Los contenedores llevan techo de memoria en el compose y Postgres va ajustado a esa medida: con los valores de fábrica se comporta como si tuviera la máquina entera.

Queda sin hacer **construir fuera de la máquina**. El swap es la red de seguridad, no la solución: con un núcleo el build tarda y compite con los envíos. Lo que corresponde es construir las imágenes en CI, publicarlas y que el servidor solo haga `pull`.

## Secretos

El `.env` no se commitea nunca. Hay un hook de `pre-commit` con [gitleaks](https://github.com/gitleaks/gitleaks) que revisa lo que estás por subir y corta el commit si encuentra algo que parezca una clave.

Se instala con:

```bash
winget install gitleaks
```

Si falta una variable de entorno, la app no arranca: el esquema de `packages/contracts/src/env` corta el proceso con el nombre de lo que falta.
