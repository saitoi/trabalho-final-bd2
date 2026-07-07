# Arquitetura

## Camadas

```text
dataset/raw/        -> dados originais, nunca modificados
dataset/processed/  -> inventário, normalização, rejeições, benchmarks e métricas
MongoDB          -> coleção consultável para demonstração e experimentos
```

## Pipeline

1. `inspect_raw_data.py` inventaria os arquivos raw e gera samples.
2. `normalize_events.py` converte fontes reais para o modelo canônico.
3. `build_benchmark_datasets.py` gera recortes de 1.000, 50.000 e 100.000 eventos.
4. `load_mongo.py` carrega JSONL em batch.
5. `run_queries.py` executa consultas obrigatórias.
6. `run_experiments.py` mede carga, consulta e falha de nó.

## MongoDB

O ambiente distribuído usa replica set `rs0` com 3 nós:

- `mongo1`, porta local `27017`
- `mongo2`, porta local `27018`
- `mongo3`, porta local `27019`

URI padrão:

```text
mongodb://host.docker.internal:27017,host.docker.internal:27018,host.docker.internal:27019/bd2?replicaSet=rs0
```

O replica set anuncia `host.docker.internal` para evitar que clientes executados no host recebam membros internos como `mongo1:27017`, que não são resolvíveis fora da rede Docker.

## Índices

- `localizacao` como `2dsphere`
- `tipo`
- `dataHora`
- `gravidade`
- `bairro`
- `cidade`
- `origem.fonte + origem.idOriginal`
