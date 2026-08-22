#!/usr/bin/env bash
# Run the scores API server and Vite together; Ctrl-C stops both.
set -euo pipefail

if ! redis-cli -u "${REDIS_URL:-redis://127.0.0.1:6379}" ping >/dev/null 2>&1; then
  echo "[dev] WARNING: Redis is not reachable — sports scores will be empty." >&2
  echo "[dev] Start it with: redis-server --daemonize yes" >&2
fi

node --watch server/src/index.js &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

vite
