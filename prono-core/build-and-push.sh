#!/usr/bin/env bash
set -e

REGISTRY="${REGISTRY:?Set REGISTRY env var to your private Docker registry}"
TAG="${1:-latest}"

echo "==> Building backend..."
docker build -t "$REGISTRY/prono-core-backend:$TAG" -t "$REGISTRY/prono-core-backend:latest" ./backend

echo "==> Building frontend..."
docker build -t "$REGISTRY/prono-core-frontend:$TAG" -t "$REGISTRY/prono-core-frontend:latest" ./frontend

echo "==> Pushing to registry..."
docker push "$REGISTRY/prono-core-backend:$TAG"
docker push "$REGISTRY/prono-core-backend:latest"
docker push "$REGISTRY/prono-core-frontend:$TAG"
docker push "$REGISTRY/prono-core-frontend:latest"

echo "==> Done. Deploy on production host with:"
echo "    docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
