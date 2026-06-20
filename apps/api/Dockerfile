# ---- Build-Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Root-Manifest + Workspace-Manifest kopieren (besseres Layer-Caching)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci

# Quellcode kopieren und bauen
COPY apps/api ./apps/api
RUN npm run prisma:generate --workspace apps/api \
  && npm run build --workspace apps/api

# ---- Runtime-Stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY apps/api/prisma ./apps/api/prisma

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
