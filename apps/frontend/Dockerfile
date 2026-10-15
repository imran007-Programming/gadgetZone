# Frontend (Next.js 16) production Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
# NEXT_PUBLIC_* values are inlined at build time, so they must be set here
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEMO_LOGIN=false
ENV NEXT_PUBLIC_DEMO_LOGIN=$NEXT_PUBLIC_DEMO_LOGIN
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Minimal runtime: only the standalone server, static assets and public files
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
# Docker sets HOSTNAME to the container id; Next's server needs 0.0.0.0 to accept outside traffic
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3001
CMD ["node", "server.js"]
