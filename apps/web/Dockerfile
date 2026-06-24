# Build-Kontext = Repository-Wurzel (npm-Workspaces).

# ---- Build-Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci

COPY apps/web ./apps/web
# NEXT_PUBLIC_* werden zur Build-Zeit ins Bundle gebacken (Browser-seitig).
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
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
