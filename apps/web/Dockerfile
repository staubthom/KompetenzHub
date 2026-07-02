# Build-Kontext = Repository-Wurzel (npm-Workspaces).

# ---- Build-Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
# Plugin-Workspaces: Manifeste (für npm ci), Quellcode (Transpile) und der
# Registry-Codegen scannt sie; scripts/ enthält den Generator (prebuild).
COPY plugins ./plugins
COPY scripts ./scripts
RUN npm ci

# Verträge & SDK bauen → liefern Typen für Web-App und Plugin-Komponenten.
RUN npm run build:packages

COPY apps/web ./apps/web
# NEXT_PUBLIC_* werden zur Build-Zeit ins Bundle gebacken (Browser-seitig).
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Versions-/Build-Info für die Fusszeile (Version stammt aus package.json; Commit
# und Build-Zeit aus dem Build-Aufruf). Werden ins Browser-Bundle eingebacken.
ARG APP_VERSION=0.0.0
ARG GIT_SHA=dev
ARG BUILD_TIME=
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
# prebuild generiert die Plugin-Registry (aus plugins/ + scripts/), dann Next-Build.
RUN npm run build --workspace apps/web

# ---- Runtime-Stage (schlankes standalone-Bundle) ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=development
ENV PORT=3000
# Next.js standalone: Server + nötige node_modules + statische Assets
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
