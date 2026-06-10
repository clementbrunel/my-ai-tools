#!/usr/bin/env bash
set -e

docker compose --env-file .env.example up --build "$@" backend
