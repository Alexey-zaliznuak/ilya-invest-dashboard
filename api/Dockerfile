# Контекст сборки — корень репозитория: образу нужен ещё и db/schema.sql.
FROM node:22-alpine AS deps
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/api
COPY --from=deps /app/api/node_modules ./node_modules
COPY api/package.json ./
COPY api/src ./src
COPY db/schema.sql /app/db/schema.sql
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
