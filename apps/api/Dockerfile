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
RUN npm ci

# Quellcode kopieren, Prisma-Client generieren und bauen
COPY apps/api ./apps/api
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build --workspace apps/api

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

WORKDIR /app/apps/api
EXPOSE 3001
# Beim Start: ausstehende DB-Migrationen anwenden, dann API starten.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
