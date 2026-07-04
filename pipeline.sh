#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RAW_DIR="${RAW_DIR:-data/raw}"
DATASET_SIZE="${DATASET_SIZE:-100000}"
BENCH_DIR="${BENCH_DIR:-data/processed/benchmarks}"
DATASET="${DATASET:-$BENCH_DIR/events_${DATASET_SIZE}.jsonl}"
RUN_EXTRACT="${RUN_EXTRACT:-0}"
RUN_EXPERIMENTS="${RUN_EXPERIMENTS:-0}"
SKIP_FAILURE="${SKIP_FAILURE:-0}"

log() {
  printf '\n==> %s\n' "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Erro: comando obrigatório não encontrado: %s\n' "$1" >&2
    exit 1
  fi
}

need_cmd uv
need_cmd docker

if [ ! -f .env ]; then
  log "Criando .env a partir de .env.example"
  cp .env.example .env
fi

log "Sincronizando dependências do projeto"
uv sync

if [ "$RUN_EXTRACT" = "1" ]; then
  log "Executando extração raw"
  uv run --script scripts/extract_raw_all.py
else
  log "Pulando extração raw (defina RUN_EXTRACT=1 para baixar fontes)"
fi

log "Inspecionando camada raw"
uv run --script scripts/inspect_raw_data.py

log "Normalizando eventos"
uv run --script scripts/normalize_events.py \
  --raw-dir "$RAW_DIR" \
  --out data/processed/events_normalized.jsonl \
  --rejected data/processed/events_rejected.jsonl \
  --target-total "$DATASET_SIZE"

log "Gerando datasets de benchmark"
uv run --script scripts/build_benchmark_datasets.py \
  --input data/processed/events_normalized.jsonl \
  --out-dir "$BENCH_DIR" \
  --seed 42

if [ ! -f "$DATASET" ]; then
  printf 'Erro: dataset esperado não encontrado: %s\n' "$DATASET" >&2
  exit 1
fi

log "Subindo MongoDB replica set"
docker compose -f docker/docker-compose.yml up -d

log "Aguardando MongoDB"
uv run --script scripts/wait_for_mongo.py --timeout 180

log "Carregando dataset $DATASET"
uv run --script scripts/load_mongo.py \
  --dataset "$DATASET" \
  --drop \
  --batch-size 1000

log "Criando índices"
uv run --script scripts/create_indexes.py

log "Executando consultas de validação"
uv run --script scripts/run_queries.py --query stats-tipo --limit 20
uv run --script scripts/run_queries.py --query tipo --tipo Incêndio --limit 3
uv run --script scripts/run_queries.py --query periodo --inicio 2025-01-01 --fim 2025-12-31 --limit 3
uv run --script scripts/run_queries.py --query raio --lat -22.9068 --lon -43.1729 --km 5 --limit 3
uv run --script scripts/run_queries.py --query gravidade --min 3 --limit 3

if [ "$RUN_EXPERIMENTS" = "1" ]; then
  log "Executando experimentos completos"
  if [ "$SKIP_FAILURE" = "1" ]; then
    uv run --script scripts/run_experiments.py --skip-failure
  else
    uv run --script scripts/run_experiments.py
  fi
else
  log "Pulando experimentos completos (defina RUN_EXPERIMENTS=1 para executar)"
fi

log "Pipeline concluída"
