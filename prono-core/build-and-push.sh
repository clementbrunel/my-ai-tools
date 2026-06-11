#!/usr/bin/env bash
set -e

REGISTRY="192.168.68.112:5000"
TAG="${1:-latest}"

echo "==> Building backend..."
docker build -t "$REGISTRY/prono-core-backend:$TAG" ./backend

echo "==> Building frontend..."
docker build -t "$REGISTRY/prono-core-frontend:$TAG" ./frontend

echo "==> Pushing to NAS registry..."
docker push "$REGISTRY/prono-core-backend:$TAG"
docker push "$REGISTRY/prono-core-frontend:$TAG"

echo "==> Done. Deploy on NAS with:"
echo "    docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
