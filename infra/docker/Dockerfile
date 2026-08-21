# Una sola imagen con tres destinos, porque las etapas de dependencias y build
# eran idénticas en los tres archivos que había antes: agregar un paquete al
# workspace obligaba a editar tres lugares y olvidarse de uno solo se notaba
# cuando fallaba el build.
#
# El contexto es la raíz del repositorio:
#   docker build -f infra/docker/Dockerfile --target api .

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
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
RUN pnpm --filter @droply/web build

# --- destinos ----------------------------------------------------------------

FROM base AS api
ENV NODE_ENV=production
COPY --from=build-api --chown=node:node /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]

FROM base AS web
ENV NODE_ENV=production
# La salida standalone ya trae su propio node_modules recortado.
COPY --from=build-web --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
