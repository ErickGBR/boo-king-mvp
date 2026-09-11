FROM node:22-alpine

# Prisma's query/schema engines are dynamically linked against libssl. On the
# slim Alpine base there is no openssl, so the engine fails to load at runtime:
#   prisma:warn Prisma failed to detect the libssl/openssl version to use...
#   Error: Could not parse schema engine response: ... "Error load" is not valid JSON
#   error Command failed with exit code 1.
# which makes `prisma db push` (this image's CMD) exit 1, so the compose backend
# never becomes healthy and the frontend's `depends_on: service_healthy` never
# starts. The production image installs openssl on bookworm for the same reason.
# MUST run before `yarn install` so the postinstall `prisma generate` hook — and
# the engine it downloads — detect OpenSSL 3 instead of the openssl-1.1.x default.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json yarn.lock ./
COPY prisma ./prisma/
RUN yarn install --frozen-lockfile

COPY . .

# Regenerate Prisma client against the final schema. The `postinstall` hook only
# runs when the dependency layer is rebuilt; a schema-only change does not
# invalidate that layer, so generate explicitly here to avoid a stale client.
RUN yarn db:generate

# Compile TypeScript (NestJS) → dist/main.js so `yarn start` works in this image.
RUN yarn build

EXPOSE 4000
CMD ["yarn", "docker:dev"]
