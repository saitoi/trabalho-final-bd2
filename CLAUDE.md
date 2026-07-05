# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Academic project for UFRJ Bancos de Dados II: a **Distributed Urban Events Monitoring and Analysis System**. It collects Brazilian urban incident data (shootings, fires, floods, etc.) from public APIs, normalizes it into a canonical schema, and loads it into a MongoDB Replica Set for performance and fault-tolerance experiments.

**Technology:** Python 3.8+, MongoDB, Docker. Package manager: `uv` (lock file present).

## Setup

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set FOGO_CRUZADO_EMAIL and FOGO_CRUZADO_PASSWORD
```

## Key Commands

### Data pipeline (run in order)

```bash
# Phase 1 — Extract raw data
python scripts/extract_raw_all.py
python scripts/extract_raw_all.py --sources fogo_cruzado,inpe_queimadas,ibge
python scripts/extract_raw_all.py --dry-run   # validate without downloading

# Phase 2 — Inspect raw layer
python scripts/inspect_raw_data.py

# Phase 3 — Normalize to canonical schema
python scripts/normalize_events.py \
  --raw-dir data/raw \
  --out data/processed/events_normalized.jsonl \
  --rejected data/processed/events_rejected.jsonl

# Phase 4 — Build benchmark datasets (1K / 50K / 100K)
python scripts/build_benchmark_datasets.py \
  --input data/processed/events_normalized.jsonl \
  --out-dir data/processed/benchmarks \
  --seed 42

# Phase 5 — Start MongoDB Replica Set
docker compose -f docker/docker-compose.yml up -d

# Phase 6 — Create indexes
python scripts/create_indexes.py

# Phase 7 — Load data
python scripts/load_mongo.py \
  --dataset data/processed/benchmarks/events_100000.jsonl \
  --drop --batch-size 1000

# Phase 8 — Run queries
python scripts/run_queries.py --query tipo --tipo Incêndio
python scripts/run_queries.py --query periodo --inicio 2025-01-01 --fim 2025-12-31
python scripts/run_queries.py --query raio --lat -22.9068 --lon -43.1729 --km 5
python scripts/run_queries.py --query gravidade --min 3
python scripts/run_queries.py --query stats-tipo
python scripts/run_queries.py --query stats-bairro
python scripts/run_queries.py --query stats-dia

# Phase 9 — Run experiments (all volumes + node-failure test)
python scripts/run_experiments.py

# Node failure test
docker stop mongo2
python scripts/run_queries.py --query stats-tipo
docker start mongo2
```

## Architecture

### Three-layer data separation (strict rule — never break this)

```
data/raw/        → original files, NEVER modified
data/processed/  → all transformations write here
MongoDB          → loaded from data/processed/benchmarks/
```

### Data sources

| Key | Description | Notes |
|-----|-------------|-------|
| `fogo_cruzado` | Armed violence incidents (RJ/PE/BA/PA) | Requires API credentials in `.env` |
| `inpe_bdqueimadas` | Satellite fire/burn detection | Automated |
| `inmet` | Historical weather data | Automated |
| `ibge` | Municipality/geographic boundaries | Automated |
| `osm` | OpenStreetMap via Overpass API | Automated |
| `nyc311` | NYC 311 service requests (volume fallback) | Automated |
| `cemaden` | Hydrological risk data | Manual download required (CAPTCHA) |
| `portal_rio_1746` | Rio city service requests | Manual download required |

OSM Geofabrik is disabled by default (files too large).

### Canonical event schema

Every normalized event must conform to:

```json
{
  "idEvento": "EVT000001",
  "tipo": "Incêndio",
  "descricao": "...",
  "dataHora": "2025-06-10T15:30:00-03:00",
  "gravidade": 4,
  "status": "Aberto",
  "bairro": "Centro",
  "cidade": "Rio de Janeiro",
  "estado": "RJ",
  "pais": "Brasil",
  "localizacao": { "type": "Point", "coordinates": [-43.1729, -22.9068] },
  "reportante": { "tipo": "Fonte pública", "identificador": "INPE" },
  "origem": { "fonte": "inpe_bdqueimadas", "idOriginal": "...", "arquivoRaw": "data/raw/..." },
  "metadados": { "categoriaOriginal": "...", "linhaOriginal": 123, "extraidoEm": "..." }
}
```

Critical invariants:
- `localizacao.coordinates` is `[longitude, latitude]` (GeoJSON order)
- `dataHora` is ISO 8601
- `gravidade` is integer 1–5
- Records without valid coordinates → `data/processed/events_rejected.jsonl` (never invented values)
- Missing fields → `null`, not fabricated values

### Consolidated event types (taxonomy)

`Tiroteio`, `Incêndio`, `Alagamento`, `Chuva intensa`, `Risco hidrológico`, `Risco geotécnico`, `Problema urbano`, `Transporte`, `Energia`, `Vazamento de água`, `Interdição de via`, `Outro`

### MongoDB collections

- `eventos` — main normalized events collection
- `fontes_raw_manifest` — metadata about processed raw files
- `experimentos` — benchmark/experiment results

Required indexes on `eventos`:
```javascript
{ "localizacao": "2dsphere" }
{ "tipo": 1 }
{ "dataHora": 1 }
{ "gravidade": 1 }
{ "bairro": 1 }
{ "cidade": 1 }
{ "origem.fonte": 1, "origem.idOriginal": 1 }
```

## Implementation Rules

- Every script must accept CLI arguments; no hardcoded paths.
- Use batch processing for large files; avoid loading entire datasets into memory.
- Scripts must be idempotent wherever possible.
- Any record-discard decision must be logged and documented.
- Add new env variables to `.env.example` whenever introducing new secrets/config.
- Never commit `.env`, credentials, or tokens.
