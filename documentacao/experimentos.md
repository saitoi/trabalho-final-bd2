# Experimentos

## Dados preparados

A pipeline local gerou os seguintes arquivos:

- `data/processed/events_normalized.jsonl`: 152.650 eventos normalizados.
- `data/processed/benchmarks/events_1000.jsonl`: 1.000 eventos.
- `data/processed/benchmarks/events_50000.jsonl`: 50.000 eventos.
- `data/processed/benchmarks/events_100000.jsonl`: 100.000 eventos.

No dataset de 100.000 eventos, 82.262 registros são do Brasil. Dados sintéticos não foram gerados porque os dados reais superaram a carga alvo.

## Execução pendente do banco

Os experimentos de MongoDB devem ser executados com Docker Desktop/daemon ativo:

```bash
uv run --script scripts/run_experiments.py
```

## Experimentos implementados

- Inserção de 1.000 registros.
- Inserção de 50.000 registros.
- Inserção de 100.000 registros.
- Consulta por tipo nos três volumes.
- Consulta por período nos três volumes.
- Consulta geográfica nos três volumes.
- Consulta agregada antes e depois de desligar `mongo2`.
- Recuperação do nó parado.

## Saídas

- `data/processed/experiments/results.json`
- `data/processed/experiments/results.csv`

## Procedimento manual equivalente

```bash
uv run --script scripts/run_queries.py --query stats-tipo
docker compose -f docker/docker-compose.yml stop mongo2
uv run --script scripts/run_queries.py --query stats-tipo
docker compose -f docker/docker-compose.yml start mongo2
```
