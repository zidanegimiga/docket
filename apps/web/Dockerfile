# Build context is the repository root: docker build -f apps/web/Dockerfile .
# API_URL is read at build time for the /api rewrite and at runtime for server-side fetches.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS pruner
RUN npm install --global turbo@2.11.8
COPY . .
RUN turbo prune @docket/web --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
ARG API_URL=http://localhost:4000
ENV API_URL=$API_URL
RUN npx turbo run build --filter=@docket/web

FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
ARG API_URL=http://localhost:4000
ENV API_URL=$API_URL
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["node", "apps/web/server.js"]
