#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8000}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"
WEB_PORT="${WEB_PORT:-3000}"

PIDS=()

log() {
  printf '==> %s\n' "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Erro: comando obrigatório não encontrado: %s\n' "$1" >&2
    exit 1
  fi
}

cleanup() {
  local pid
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

need_cmd uv
need_cmd npm

if [ ! -f .env ]; then
  log ".env não encontrado; criando a partir de .env.example"
  cp .env.example .env
  printf 'Aviso: revise .env se precisar alterar MONGO_URI ou credenciais de extração.\n' >&2
fi

log "Sincronizando dependências Python"
uv sync

if [ ! -d frontend/node_modules ]; then
  log "Instalando dependências do frontend"
  npm --prefix frontend install
fi

log "Subindo API em http://${API_HOST}:${API_PORT}"
uv run fastapi dev --host "$API_HOST" --port "$API_PORT" &
PIDS+=("$!")

log "Subindo frontend em http://${WEB_HOST}:${WEB_PORT}"
npm --prefix frontend run dev -- --host "$WEB_HOST" --port "$WEB_PORT" &
PIDS+=("$!")

log "Serviços iniciados. Pressione Ctrl+C para encerrar ambos."
wait -n "${PIDS[@]}"
