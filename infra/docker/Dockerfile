# Una sola imagen con tres destinos, porque las etapas de dependencias y build
# eran idénticas en los tres archivos que había antes: agregar un paquete al
# workspace obligaba a editar tres lugares y olvidarse de uno solo se notaba
# cuando fallaba el build.
#
# El contexto es la raíz del repositorio:
#   docker build -f infra/docker/Dockerfile --target api .

# Debian y no Alpine, y esto no es preferencia.
#
# `argon2` es un módulo nativo y trae binarios listos para `linux-x64`, que es
# glibc. Para musl —lo de Alpine— no trae ninguno: en `prebuilds/` están
# darwin-arm64, freebsd, linux-arm, linux-arm64, linux-x64 y win32-x64, y no
# hay linuxmusl. En Alpine el binario no carga, y sin argon2 no se puede ni
# entrar ni registrar a nadie: el servidor arranca y falla en el primer login.
#
# La otra salida era quedarse en Alpine y compilarlo desde el código, lo que
# pide python3, make y g++ dentro de la imagen, y compilar en una máquina de un
# núcleo. Cambiar una palabra sale más barato.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

# El motor de Prisma enlaza contra OpenSSL, y las imágenes `slim` vienen sin él.
# Sin esto el API arranca y revienta en la primera consulta.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

# Los manifiestos van primero y solos: mientras no cambien, esta capa sale de
# caché aunque haya cambiado todo el código.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/tooling/package.json packages/tooling/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY . .
RUN pnpm --filter @droply/contracts build \
  && pnpm --filter @droply/api exec prisma generate

FROM build AS build-api
RUN pnpm --filter @droply/api build

FROM build AS build-web
# Next incrusta las `NEXT_PUBLIC_*` en el JavaScript que descarga el navegador,
# así que esto se decide al construir y no al arrancar: sin pasarlo aquí, la
# imagen queda pidiéndole el API a `localhost:3001`, que en el equipo de quien
# entra no es nadie. Cambiar de dominio obliga a reconstruir el front.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @droply/web build

# --- destinos ----------------------------------------------------------------

FROM base AS api
ENV NODE_ENV=production
COPY --from=build-api --chown=node:node /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 3001

# Las migraciones corren al arrancar, antes que el servidor.
#
# No las corría nadie: `db:deploy` existía como script y no lo invocaba ni el
# compose ni esta imagen, así que un despliegue nuevo levantaba el API contra
# una base sin tablas y fallaba en la primera consulta.
#
# Va acá y no en un servicio aparte del compose porque el cliente de Prisma ya
# está en la imagen y así no hay dos sitios que recordar. `migrate deploy` solo
# aplica lo que falta y toma un lock, así que repetirlo no hace nada; si falla,
# el contenedor no arranca, que es lo correcto: mejor eso que servir contra un
# esquema a medias.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]

FROM base AS web
ENV NODE_ENV=production
# La salida standalone ya trae su propio node_modules recortado.
COPY --from=build-web --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
