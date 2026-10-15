#!/usr/bin/env bash
# Antes de cada comando: se o package-lock.json mudou desde o último npm ci, reinstala os pacotes de Node
# (o node_modules fica num volume do Docker, separado da pasta do projeto no computador).
set -euo pipefail
cd /app
if [ -f package-lock.json ]; then
  want="$(sha256sum package-lock.json | cut -d' ' -f1)"
  have="$(cat node_modules/.lock-hash 2>/dev/null || true)"
  if [ "$want" != "$have" ]; then
    echo "package-lock.json mudou: npm ci…" >&2
    npm ci --no-audit --no-fund >&2
    echo "$want" > node_modules/.lock-hash
  fi
fi
exec "$@"
