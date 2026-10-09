# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- build (Vite)
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund

COPY . .

# links shown on the admin "System" page (public URLs, baked into the bundle)
ARG VITE_GRAFANA_URL=http://34.171.152.81:3001
ARG VITE_KAFKA_UI_URL=http://34.171.152.81:8090
ARG VITE_MAILPIT_URL=http://34.171.152.81:8025
ENV VITE_GRAFANA_URL=$VITE_GRAFANA_URL \
    VITE_KAFKA_UI_URL=$VITE_KAFKA_UI_URL \
    VITE_MAILPIT_URL=$VITE_MAILPIT_URL

RUN npm run build

# ---------------------------------------------------------------- runtime (nginx)
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
