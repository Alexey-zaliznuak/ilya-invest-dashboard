FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html admin.html ./
COPY public ./public
COPY src ./src
RUN npm run typecheck && npm run build

FROM nginx:1.29-alpine AS runtime
ENV API_UPSTREAM=api:3000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
