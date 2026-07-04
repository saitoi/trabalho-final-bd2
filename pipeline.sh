#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RAW_DIR="${RAW_DIR:-data/raw}"
DATASET_SIZE="${DATASET_SIZE:-100000}"
BENCH_DIR="${BENCH_DIR:-data/processed/benchmarks}"
DATASET="${DATASET:-$BENCH_DIR/events_${DATASET_SIZE}.jsonl}"
RUN_EXTRACT="${RUN_EXTRACT:-1}"
RUN_EXPERIMENTS="${RUN_EXPERIMENTS:-0}"
SKIP_FAILURE="${SKIP_FAILURE:-0}"
ENV_CREATED=0

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
  ENV_CREATED=1
  printf 'Aviso: .env foi criado com valores vazios. Edite .env antes de usar RUN_EXTRACT=1.\n' >&2
fi

load_env() {
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
}

env_value_missing() {
  local name="$1"
  local value="${!name:-}"
  [ -z "$value" ]
}

raw_has_input() {
  find "$RAW_DIR" -type f ! -name '.gitkeep' -print -quit 2>/dev/null | grep -q .
}

source_present() {
  local source="$1"
  case "$source" in
    fogo_cruzado)
      find "$RAW_DIR/fogo_cruzado/occurrences" -type f -name '*.jsonl' -print -quit 2>/dev/null | grep -q .
      ;;
    inpe_queimadas)
      find "$RAW_DIR/inpe_bdqueimadas/focos_csv_mensal_brasil/files" -type f \( -name '*.csv' -o -name '*.zip' \) -print -quit 2>/dev/null | grep -q .
      ;;
    inmet)
      find "$RAW_DIR/inmet/dados_historicos_anuais" -type f -name '*.zip' -print -quit 2>/dev/null | grep -q .
      ;;
    ibge)
      find "$RAW_DIR/ibge" -type f \( -name '*.json' -o -name '*.geojson' \) -print -quit 2>/dev/null | grep -q .
      ;;
    osm_overpass)
      find "$RAW_DIR/osm/overpass" -type f -name '*.json' -print -quit 2>/dev/null | grep -q .
      ;;
    nyc311)
      find "$RAW_DIR/nyc311" -maxdepth 1 -type f -name '*.jsonl' -print -quit 2>/dev/null | grep -q .
      ;;
    cemaden_manual)
      [ -f "$RAW_DIR/cemaden/manual_downloads_manifest.json" ] || [ -f "$RAW_DIR/cemaden/MANUAL_DOWNLOAD.md" ]
      ;;
    portal_rio_manual)
      [ -f "$RAW_DIR/portal_rio_1746/manual_downloads_manifest.json" ] || [ -f "$RAW_DIR/portal_rio_1746/MANUAL_DOWNLOAD.md" ]
      ;;
    *)
      return 1
      ;;
  esac
}

missing_sources_csv() {
  local defaults=(
    fogo_cruzado
    inpe_queimadas
    inmet
    ibge
    osm_overpass
    nyc311
    cemaden_manual
    portal_rio_manual
  )
  local missing=()
  local source
  for source in "${defaults[@]}"; do
    if ! source_present "$source"; then
      missing+=("$source")
    fi
  done
  local IFS=,
  printf '%s' "${missing[*]}"
}

load_env

if env_value_missing MONGO_URI; then
  printf 'Aviso: MONGO_URI ausente no .env. Usando valor padrão dos scripts.\n' >&2
fi

log "Sincronizando dependências do projeto"
uv sync

if [ "$RUN_EXTRACT" = "1" ]; then
  MISSING_SOURCES="${SOURCES:-$(missing_sources_csv)}"
  if [ -z "$MISSING_SOURCES" ]; then
    log "Todas as fontes padrão já possuem arquivos em $RAW_DIR; extração pulada"
  else
    if printf ',%s,' "$MISSING_SOURCES" | grep -q ',fogo_cruzado,'; then
      if env_value_missing FOGO_CRUZADO_EMAIL || env_value_missing FOGO_CRUZADO_PASSWORD; then
        printf 'Aviso: Fogo Cruzado está ausente, mas FOGO_CRUZADO_EMAIL/FOGO_CRUZADO_PASSWORD não estão configurados no .env.\n' >&2
        printf 'Aviso: a extração continuará para as demais fontes. Preencha .env e rode novamente para baixar Fogo Cruzado.\n' >&2
        MISSING_SOURCES="$(printf '%s' "$MISSING_SOURCES" | awk -v RS=, -v ORS=, '$0 != "fogo_cruzado" { print }' | sed 's/,$//')"
      fi
    fi

    if [ -n "$MISSING_SOURCES" ]; then
      log "Executando extração incremental para fontes ausentes: $MISSING_SOURCES"
      uv run --script scripts/extract_raw_all.py --sources "$MISSING_SOURCES"
    else
      log "Nenhuma fonte automática restante para extrair"
    fi
  fi
else
  log "Pulando extração raw (defina RUN_EXTRACT=1 para baixar fontes)"
  if [ "$ENV_CREATED" = "1" ]; then
    printf 'Aviso: como o .env acabou de ser criado, a extração foi pulada. A pipeline usará dados já presentes em %s, se existirem.\n' "$RAW_DIR" >&2
  fi
  if ! raw_has_input; then
    printf 'Erro: não há dados raw em %s. Configure .env e rode RUN_EXTRACT=1 ./pipeline.sh, ou coloque dados raw nesse diretório.\n' "$RAW_DIR" >&2
    exit 1
  fi
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
