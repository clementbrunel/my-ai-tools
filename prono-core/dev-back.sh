#!/usr/bin/env bash
set -e

ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env.example"
fi

docker compose --env-file "$ENV_FILE" up --build "$@" backend
