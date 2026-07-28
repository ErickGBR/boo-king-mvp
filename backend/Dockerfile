FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

COPY . .

EXPOSE 4000
CMD ["npm", "run", "docker:dev"]
