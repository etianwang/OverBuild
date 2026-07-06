# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY apps/web/package.json ./apps/web/package.json
COPY prisma ./prisma
RUN npm run db:generate
RUN npm run build -w @overbuild/api

FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY prisma ./prisma
RUN npm ci --workspace=@overbuild/api --include-workspace-root --omit=dev \
  && npm install prisma@6.9.0 --no-save \
  && npx prisma generate

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY prisma ./prisma
COPY docker/api-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

WORKDIR /app/apps/api
EXPOSE 3001
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/main.js"]
