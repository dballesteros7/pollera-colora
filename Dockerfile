# build
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# lockfile is written by npm 11; npm 10 (bundled with node 22) misreads its optional deps
RUN npm install -g npm@11 && npm ci
COPY . .
RUN npm run build

# run
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/polla.db

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# drizzle migrations run at first DB connection
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3000
CMD ["node", "server.js"]
