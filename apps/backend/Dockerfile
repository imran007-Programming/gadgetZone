# Backend (NestJS) production Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
# Prisma engines on alpine need openssl
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --legacy-peer-deps && npx prisma generate
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
# Migrations run on every start; seeding is manual (npx prisma db seed) so a restart never wipes data
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
