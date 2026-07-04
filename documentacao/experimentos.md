# Experimentos

## Dados preparados

A pipeline local gerou os seguintes arquivos:

- `data/processed/events_normalized.jsonl`: 152.650 eventos normalizados.
- `data/processed/benchmarks/events_1000.jsonl`: 1.000 eventos.
- `data/processed/benchmarks/events_50000.jsonl`: 50.000 eventos.
- `data/processed/benchmarks/events_100000.jsonl`: 100.000 eventos.

No dataset de 100.000 eventos, 82.262 registros são do Brasil. Dados sintéticos não foram gerados porque os dados reais superaram a carga alvo.

## Execução no MongoDB

Os experimentos foram executados em `2026-07-04` com MongoDB 7.0 em replica set `rs0` com três nós Docker.

## Experimentos implementados

- Inserção de 1.000 registros.
- Inserção de 50.000 registros.
- Inserção de 100.000 registros.
- Consulta por tipo nos três volumes.
- Consulta por período nos três volumes.
- Consulta geográfica nos três volumes.
- Consulta agregada antes e depois de desligar `mongo2`.
- Recuperação do nó parado.

## Resultados

| Teste | 1.000 registros | 50.000 registros | 100.000 registros |
| --- | ---: | ---: | ---: |
| Inserção | 0,063 s | 4,145 s | 8,836 s |
| Consulta por tipo `Incêndio` | 0,001 s / 83 resultados | 0,010 s / 4.166 resultados | 0,026 s / 33.772 resultados |
| Consulta por período 2025 | 0,001 s / 0 resultados | 0,002 s / 1.569 resultados | 0,003 s / 1.569 resultados |
| Consulta geográfica Centro-RJ, 5 km | 0,001 s / 14 resultados | 0,046 s / 1.819 resultados | 0,103 s / 1.837 resultados |

## Falha de nó

O experimento executou uma agregação por tipo antes e depois de parar `mongo2`.

- Antes da falha: 0,108 s, 100.000 registros agregados.
- Depois da falha: 0,176 s, 100.000 registros agregados.
- Resultado consistente: sim.
- Recuperação após religar `mongo2`: 5,008 s.

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
