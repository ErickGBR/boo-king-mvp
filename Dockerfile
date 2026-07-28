FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:22-bookworm-slim AS backend
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
COPY backend/prisma ./prisma/
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV DATABASE_URL="file:/tmp/placeholder.db"
ENV PRISMA_CLI_BINARY_TARGETS="debian-openssl-3.0.x"
RUN npm ci
COPY backend/ .
COPY --from=frontend /app/frontend/dist ./public
EXPOSE 4000
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/sqlite.db"
CMD ["sh", "-c", "npx prisma migrate deploy; npx prisma db push; node prisma/seed.js; node src/index.js"]
