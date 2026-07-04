# Sistema Distribuído de Eventos Urbanos - BD II

Projeto acadêmico da disciplina Bancos de Dados II da UFRJ. A solução usa MongoDB em replica set com 3 nós para armazenar, consultar e analisar eventos urbanos normalizados a partir de fontes públicas.

## Requisitos

- `uv`
- Docker com Compose
- Python 3.12, gerenciado pelo `uv`

As dependências ficam no `pyproject.toml`. Os scripts também possuem shebang compatível com `uv run --script`.

## Pipeline

Para executar o fluxo ponta a ponta em um clone novo, use:

```bash
./pipeline.sh
```

Por padrão ele não baixa dados raw novos. Para executar a extração antes da normalização:

```bash
RUN_EXTRACT=1 ./pipeline.sh
```

Para incluir os experimentos completos:

```bash
RUN_EXPERIMENTS=1 ./pipeline.sh
```

```bash
uv run --script scripts/inspect_raw_data.py

uv run --script scripts/normalize_events.py \
  --raw-dir data/raw \
  --out data/processed/events_normalized.jsonl \
  --rejected data/processed/events_rejected.jsonl

uv run --script scripts/build_benchmark_datasets.py \
  --input data/processed/events_normalized.jsonl \
  --out-dir data/processed/benchmarks \
  --seed 42
```

Os dados em `data/raw/` nunca são modificados. O Git versiona apenas `data/raw/.gitkeep`.

## MongoDB Distribuído

```bash
docker compose -f docker/docker-compose.yml up -d
uv run --script scripts/wait_for_mongo.py
uv run --script scripts/create_indexes.py
```

## Carga e Consultas

```bash
uv run --script scripts/load_mongo.py \
  --dataset data/processed/benchmarks/events_100000.jsonl \
  --drop \
  --batch-size 1000

uv run --script scripts/run_queries.py --query stats-tipo
uv run --script scripts/run_queries.py --query tipo --tipo Incêndio
uv run --script scripts/run_queries.py --query periodo --inicio 2025-01-01 --fim 2025-12-31
uv run --script scripts/run_queries.py --query raio --lat -22.9068 --lon -43.1729 --km 5
uv run --script scripts/run_queries.py --query gravidade --min 3
```

## Experimentos

```bash
uv run --script scripts/run_experiments.py
```

Esse comando mede inserção, consultas nos três volumes e tolerância a falhas com parada/reinício de um nó. Use `--skip-failure` para evitar comandos `docker stop/start`.

## Fontes e Sintéticos

A normalização prioriza dados reais do Rio de Janeiro e do Brasil. Dados sintéticos só são gerados se os registros reais disponíveis não bastarem para atingir a carga alvo, e sempre ficam marcados com `origem.fonte = "synthetic_rio"`.

No Docker Desktop, a URI padrão usa `host.docker.internal` para que o replica set anuncie endereços resolvíveis tanto pelos containers quanto pelos scripts executados no host.
