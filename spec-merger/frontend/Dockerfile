FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Deployment sub-path, e.g. --build-arg VITE_BASE=spec-merger
ARG VITE_BASE=/
ENV VITE_BASE=$VITE_BASE
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/oidc-on /etc/nginx/oidc-on
COPY nginx/oidc-off /etc/nginx/oidc-off
COPY --chmod=755 docker-entrypoint.d/40-oidc.sh /docker-entrypoint.d/40-oidc.sh
# Defensive: a CRLF shebang (Windows checkout) makes the entrypoint fail with "not found".
RUN sed -i 's/$//' /docker-entrypoint.d/40-oidc.sh /etc/nginx/oidc-on/* /etc/nginx/oidc-off/*
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid
EXPOSE 80
USER nginx
