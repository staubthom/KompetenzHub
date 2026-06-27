# Build-Kontext = Repository-Wurzel (npm-Workspaces).

# ---- Build-Stage ----
FROM node:20-alpine AS builder
# Prisma benötigt OpenSSL (Alpine/musl)
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
# Manifeste aller Workspaces für npm ci (besseres Layer-Caching)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
# Plugin-Workspaces: Manifeste (für npm ci) + Quellcode (SDK/Verträge + Plugin-Server).
COPY plugins ./plugins
RUN npm ci

# Verträge & SDK bauen → Typen + Laufzeit-Helfer (z. B. PluginHttpError) für die API.
RUN npm run build:packages

# Quellcode kopieren, Prisma-Client generieren und API bauen
COPY apps/api ./apps/api
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build --workspace apps/api

# Plugin-Server-Bundles bauen (Discovery lädt zur Laufzeit dist/server/index.js).
RUN for d in plugins/packages/*/; do npm run build --workspace "${d%/}" --if-present; done

# ---- Runtime-Stage ----
FROM node:20-alpine AS runner
# Prisma (Query- & Migrations-Engine) benötigt OpenSSL
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production
# Voller node_modules-Satz inkl. Prisma-CLI (für `migrate deploy` beim Start)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
# Plugin-Plattform: Manifeste + gebaute SDK-/Server-Bundles. Die Workspace-Symlinks in
# node_modules (@kompetenzhub/plugin-*) zeigen hierher, und die Registry entdeckt zur
# Laufzeit plugins/packages/*/manifest.json.
COPY --from=builder /app/plugins ./plugins

WORKDIR /app/apps/api
EXPOSE 3001
# Beim Start: ausstehende DB-Migrationen anwenden, dann API starten.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
