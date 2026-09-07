# Backend-only production image (two-service topology: see root render.yaml).
# The API no longer serves the SPA — the frontend is deployed as its own
# service (./frontend/Dockerfile) — so there is no `--from=frontend` stage and
# no `./public` copy here anymore.
FROM node:22-bookworm-slim AS backend
WORKDIR /app
# `yarn.lock` is a LITERAL copy on purpose (it used to be `yarn.lock*`).
# Docker tolerates a glob that matches nothing, and `yarn install
# --frozen-lockfile` with no lockfile does NOT fail: it resolves every semver
# range fresh (observed: exit 0, no yarn.lock written). A silent
# non-reproducible image is worse than a loud build error, so a missing
# lockfile (e.g. a clone where backend/yarn.lock was never committed) now
# fails here.
COPY backend/package.json backend/yarn.lock ./
COPY backend/prisma ./prisma/
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV DATABASE_URL="file:/tmp/placeholder.db"
ENV PRISMA_CLI_BINARY_TARGETS="debian-openssl-3.0.x"
RUN yarn install --frozen-lockfile
COPY backend/ .
# Regenerate Prisma client against the final schema (postinstall is layer-cached
# on package.json/yarn.lock, so a schema-only change would leave a stale client).
RUN yarn db:generate
# Compile TypeScript (NestJS) → dist/main.js for the production start command.
RUN yarn build
EXPOSE 4000
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/sqlite.db"
CMD ["sh", "-c", "yarn db:push && yarn db:seed && yarn start"]
