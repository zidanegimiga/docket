# Build context is the repository root: docker build -f apps/api/Dockerfile .

FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS pruner
RUN npm install --global turbo@2.11.8
COPY . .
RUN turbo prune @docket/api --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
RUN npx turbo run build --filter=@docket/api

FROM base AS runner
ENV NODE_ENV=production
COPY --from=pruner /app/out/json/ .
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

WORKDIR /app/apps/api
USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 4000) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
