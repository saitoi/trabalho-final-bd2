# AGENTS.md

## Contexto do projeto

Veja: ./domain_context/instrucoes-trabalho.pdf

Este repositório implementa o trabalho prático da disciplina **Bancos de Dados II** da UFRJ: um **Sistema Distribuído de Monitoramento e Análise de Eventos Urbanos**.

O objetivo é construir uma aplicação capaz de armazenar, consultar e analisar ocorrências urbanas reportadas por fontes públicas reais, sensores ou bases externas. O trabalho exige o uso de uma tecnologia NoSQL/distribuída entre as opções permitidas: **MongoDB**, **Apache Cassandra** ou **Redis**.

A decisão técnica recomendada para este projeto é usar **MongoDB**, porque o modelo de evento urbano é naturalmente documental, possui campos aninhados, suporta índice geoespacial nativo e simplifica consultas por tipo, período, gravidade, localização e estatísticas agregadas.

A camada de extração raw já foi iniciada/concluída. Os dados brutos devem estar em `data/raw/`, separados por fonte. A próxima fase do projeto é transformar essa camada raw em um dataset normalizado, carregável no banco distribuído e adequado aos experimentos exigidos pelo trabalho.

## Escopo acadêmico

O trabalho pede um sistema para registrar e acompanhar ocorrências urbanas, como acidentes de trânsito, alagamentos, quedas de energia, incêndios, problemas no transporte público, vazamentos de água, interdições de vias, deslizamentos de terra e tiroteios.

O sistema deve permitir inserção, consultas por tipo, período, localização geográfica, gravidade e estatísticas agregadas. Também deve demonstrar funcionamento distribuído com 3 nós, replicação, tolerância a falhas e experimentos de desempenho com 1.000, 50.000 e 100.000 registros.

## Fontes de dados consideradas

A pipeline raw foi planejada para trabalhar com estas fontes:

- `fogo_cruzado`: ocorrências de violência armada, principalmente Rio de Janeiro, Pernambuco, Bahia e Pará.
- `inpe_bdqueimadas`: focos de queimadas/incêndios do INPE.
- `inmet`: dados meteorológicos históricos anuais.
- `ibge`: localidades e malhas territoriais.
- `osm`: dados espaciais do OpenStreetMap, via Overpass ou Geofabrik.
- `nyc311`: base internacional de solicitações urbanas, usada como fallback de volume.
- `cemaden`: fonte manual/semiautomática por exigir confirmação de segurança.
- `portal_rio_1746`: fonte manual/semiautomática por não haver endpoint bruto estável identificado.

A prioridade de uso para o dataset final é:

1. Fontes brasileiras aderentes ao tema.
2. Dados do Rio de Janeiro, quando existirem.
3. Dados de outras cidades brasileiras.
4. Dados internacionais apenas para complementar volume ou diversidade.

## Estrutura esperada do repositório

```text
.
├── AGENTS.md
├── README.md
├── requirements.txt
├── .env.example
├── scripts/
│   ├── extract_raw_all.py
│   ├── inspect_raw_data.py
│   ├── normalize_events.py
│   ├── build_benchmark_datasets.py
│   ├── load_mongo.py
│   ├── create_indexes.py
│   ├── run_queries.py
│   └── run_experiments.py
├── data/
│   ├── raw/
│   ├── processed/
│   └── samples/
├── docker/
│   ├── docker-compose.yml
│   └── init-replica-set.js
├── app/
│   ├── api/
│   └── cli/
└── documentacao/
    ├── fontes.md
    ├── modelo_dados.md
    ├── arquitetura.md
    ├── experimentos.md
    └── relatorio.md
```

A estrutura pode variar, mas os diretórios `scripts/`, `data/raw/`, `data/processed/`, `docker/` e `documentacao/` devem permanecer claros.

## Princípio central da arquitetura de dados

Separar rigidamente três camadas:

```text
data/raw/        -> dados originais, nunca modificados
data/processed/  -> dados normalizados, filtrados e enriquecidos
database         -> dados carregados para consulta e experimento
```

Regras:

- Nunca alterar arquivos em `data/raw/`.
- Toda transformação deve escrever em `data/processed/`.
- Toda decisão de descarte ou adaptação deve ser documentada.
- Cada evento normalizado deve preservar sua origem.
- Dados ausentes devem virar `null`, não valores inventados.

## Modelo canônico do evento

A camada raw não deve alterar os dados originais. A normalização deve produzir documentos no seguinte formato:

```json
{
  "idEvento": "EVT000001",
  "tipo": "Incêndio",
  "descricao": "Foco de queimada detectado por satélite",
  "dataHora": "2025-06-10T15:30:00-03:00",
  "gravidade": 4,
  "status": "Aberto",
  "bairro": "Centro",
  "cidade": "Rio de Janeiro",
  "estado": "RJ",
  "pais": "Brasil",
  "localizacao": {
    "type": "Point",
    "coordinates": [-43.1729, -22.9068]
  },
  "reportante": {
    "tipo": "Fonte pública",
    "identificador": "INPE"
  },
  "origem": {
    "fonte": "inpe_bdqueimadas",
    "idOriginal": "string-ou-null",
    "arquivoRaw": "data/raw/..."
  },
  "metadados": {
    "categoriaOriginal": "string-ou-null",
    "linhaOriginal": 123,
    "extraidoEm": "2026-07-04T12:00:00Z"
  }
}
```

### Regras importantes do modelo

- `localizacao.coordinates` deve seguir o padrão GeoJSON: `[longitude, latitude]`.
- `dataHora` deve ser ISO 8601.
- `tipo` deve ser uma categoria consolidada.
- `gravidade` deve ser inteiro de 1 a 5.
- `origem` deve sempre preservar a rastreabilidade da fonte raw.
- Dados ausentes devem ser preenchidos com `null`, não com valores inventados.
- Registros sem coordenada devem ser descartados do dataset principal ou enviados para arquivo de rejeitados.

## Categorias consolidadas sugeridas

Use uma taxonomia simples e estável:

- `Tiroteio`
- `Incêndio`
- `Alagamento`
- `Chuva intensa`
- `Risco hidrológico`
- `Risco geotécnico`
- `Problema urbano`
- `Transporte`
- `Energia`
- `Vazamento de água`
- `Interdição de via`
- `Outro`

A função de normalização deve mapear categorias originais de cada fonte para uma dessas categorias.

## Regras sugeridas para gravidade

A gravidade deve ser derivada por regras simples, documentáveis e reprodutíveis.

### Fogo Cruzado

- Gravidade 5: ocorrência com mortos.
- Gravidade 4: ocorrência com feridos.
- Gravidade 3: tiroteio sem vítimas registradas.
- Gravidade 2: disparos/ocorrência menos grave, quando indicado pela fonte.
- Gravidade 1: registro incompleto ou baixa criticidade.

### INPE BDQueimadas

- Gravidade 5: foco com alta intensidade ou em área urbana/protegida, se houver campo aplicável.
- Gravidade 4: foco confirmado por satélite de referência ou múltiplos focos próximos.
- Gravidade 3: foco comum com coordenada válida.
- Gravidade 2: foco com baixa confiança, se houver campo aplicável.
- Gravidade 1: registro incompleto.

### INMET/Cemaden

- Gravidade 5: chuva extrema ou acumulado muito alto.
- Gravidade 4: chuva forte.
- Gravidade 3: chuva moderada.
- Gravidade 2: chuva fraca.
- Gravidade 1: observação meteorológica sem risco urbano claro.

Documentar os limiares usados em `documentacao/modelo_dados.md`.

## Banco de dados recomendado

Use **MongoDB Replica Set com 3 nós** via Docker.

Justificativa:

- O evento possui estrutura documental.
- Há campos aninhados (`localizacao`, `reportante`, `origem`, `metadados`).
- MongoDB possui índice `2dsphere` para consulta geográfica.
- Agregações por tipo, bairro e data são simples.
- Replica set permite demonstrar replicação e tolerância a falhas.

## Coleções sugeridas

### `eventos`

Coleção principal com eventos normalizados.

Índices recomendados:

```javascript
db.eventos.createIndex({ "localizacao": "2dsphere" })
db.eventos.createIndex({ "tipo": 1 })
db.eventos.createIndex({ "dataHora": 1 })
db.eventos.createIndex({ "gravidade": 1 })
db.eventos.createIndex({ "bairro": 1 })
db.eventos.createIndex({ "cidade": 1 })
db.eventos.createIndex({ "origem.fonte": 1, "origem.idOriginal": 1 }, { unique: false })
```

### `fontes_raw_manifest`

Metadados sobre arquivos raw processados.

### `experimentos`

Resultados de benchmarks de inserção, consulta e falha de nó.

## Consultas obrigatórias

Implemente scripts ou endpoints para:

1. Inserir novo evento.
2. Listar eventos por tipo.
3. Consultar eventos por período.
4. Consultar eventos em raio geográfico.
5. Consultar eventos por gravidade.
6. Gerar quantidade por tipo.
7. Gerar quantidade por bairro.
8. Gerar evolução temporal por dia.
9. Comparar resultados antes e depois de desligar um nó.

# Plano de continuação

## Etapa 1 — Inspecionar a camada raw

Criar `scripts/inspect_raw_data.py`.

Objetivos:

- Listar arquivos em `data/raw/`.
- Contar registros por fonte.
- Identificar colunas/campos disponíveis.
- Gerar relatório em `data/processed/raw_inventory.json`.
- Gerar uma amostra por fonte em `data/samples/`.

Saída esperada:

```text
data/processed/raw_inventory.json
data/samples/fogo_cruzado_sample.json
data/samples/inpe_bdqueimadas_sample.csv
data/samples/nyc311_sample.json
```

Critérios de aceite:

- O script não falha se alguma fonte estiver ausente.
- O relatório mostra número aproximado de registros por fonte.
- O relatório mostra campos disponíveis por fonte.
- O script registra arquivos corrompidos ou formatos inesperados.

## Etapa 2 — Implementar normalização

Criar `scripts/normalize_events.py`.

Objetivos:

- Ler dados brutos de cada fonte.
- Converter para o modelo canônico.
- Preservar rastreabilidade em `origem`.
- Validar latitude/longitude.
- Validar data/hora.
- Aplicar taxonomia consolidada.
- Calcular gravidade.
- Salvar em `data/processed/events_normalized.jsonl`.

Critérios de aceite:

- O arquivo final deve ter pelo menos 100.000 eventos, se as fontes disponíveis permitirem.
- Cada evento deve ter `idEvento`, `tipo`, `dataHora`, `gravidade`, `cidade` e `localizacao`.
- Registros sem coordenada devem ser descartados ou salvos em arquivo separado de rejeitados.
- Criar `data/processed/events_rejected.jsonl` com motivo de rejeição.

Parâmetros sugeridos:

```bash
python scripts/normalize_events.py \
  --raw-dir data/raw \
  --out data/processed/events_normalized.jsonl \
  --rejected data/processed/events_rejected.jsonl
```

## Etapa 3 — Gerar datasets de benchmark

Criar `scripts/build_benchmark_datasets.py`.

Objetivos:

- Gerar três recortes:
  - `events_1000.jsonl`
  - `events_50000.jsonl`
  - `events_100000.jsonl`
- A seleção deve ser determinística, usando seed fixa.
- Preferir diversidade de fontes e tipos.
- Salvar estatísticas dos recortes.

Saída esperada:

```text
data/processed/benchmarks/events_1000.jsonl
data/processed/benchmarks/events_50000.jsonl
data/processed/benchmarks/events_100000.jsonl
data/processed/benchmarks/summary.json
```

Comando sugerido:

```bash
python scripts/build_benchmark_datasets.py \
  --input data/processed/events_normalized.jsonl \
  --out-dir data/processed/benchmarks \
  --seed 42
```

## Etapa 4 — Configurar MongoDB distribuído

Criar `docker/docker-compose.yml` com:

- `mongo1`
- `mongo2`
- `mongo3`
- rede Docker dedicada
- volumes persistentes
- script de inicialização do replica set

Criar também:

```text
docker/init-replica-set.js
scripts/wait_for_mongo.py
```

Critérios de aceite:

- `docker compose up -d` sobe 3 nós.
- Replica set inicializa automaticamente ou com comando documentado.
- `rs.status()` mostra os três membros.
- A aplicação consegue escrever e ler do replica set.

## Etapa 5 — Criar índices

Criar `scripts/create_indexes.py`.

Objetivos:

- Criar índice geoespacial `2dsphere`.
- Criar índices para tipo, data, gravidade, bairro, cidade e fonte.
- Medir tempo de criação dos índices.
- Registrar resultado em `data/processed/index_report.json`.

Comando sugerido:

```bash
python scripts/create_indexes.py
```

## Etapa 6 — Carregar dados no MongoDB

Criar `scripts/load_mongo.py`.

Objetivos:

- Carregar datasets de 1.000, 50.000 e 100.000 registros.
- Medir tempo total de inserção.
- Usar batch insert.
- Permitir limpar coleção antes do carregamento.
- Registrar métricas em `data/processed/load_results.json`.

Parâmetros sugeridos:

```bash
python scripts/load_mongo.py \
  --dataset data/processed/benchmarks/events_100000.jsonl \
  --drop \
  --batch-size 1000
```

## Etapa 7 — Implementar consultas

Criar `scripts/run_queries.py`.

Consultas mínimas:

```bash
python scripts/run_queries.py --query tipo --tipo Incêndio
python scripts/run_queries.py --query periodo --inicio 2025-01-01 --fim 2025-12-31
python scripts/run_queries.py --query raio --lat -22.9068 --lon -43.1729 --km 5
python scripts/run_queries.py --query gravidade --min 3
python scripts/run_queries.py --query stats-tipo
python scripts/run_queries.py --query stats-bairro
python scripts/run_queries.py --query stats-dia
```

Cada execução deve imprimir resultado resumido e salvar métrica de tempo.

## Etapa 8 — Rodar experimentos

Criar `scripts/run_experiments.py`.

Experimentos obrigatórios:

1. Inserção de 1.000 registros.
2. Inserção de 50.000 registros.
3. Inserção de 100.000 registros.
4. Consulta por tipo nos três volumes.
5. Consulta por período nos três volumes.
6. Consulta geográfica nos três volumes.
7. Consulta normal com 3 nós.
8. Desligar um nó.
9. Repetir consulta.
10. Comparar tempo e consistência dos resultados.

Saída esperada:

```text
data/processed/experiments/results.json
data/processed/experiments/results.csv
documentacao/experimentos.md
```

## Etapa 9 — Testar falha de nó

Criar script ou instruções para:

```bash
docker stop mongo2
python scripts/run_queries.py --query stats-tipo
docker start mongo2
```

Registrar:

- consulta antes da falha;
- consulta depois da falha;
- tempo antes/depois;
- se o resultado permaneceu consistente;
- tempo de recuperação do nó.

## Etapa 10 — Documentação final

Gerar os arquivos:

```text
documentacao/fontes.md
documentacao/modelo_dados.md
documentacao/arquitetura.md
documentacao/experimentos.md
documentacao/relatorio.md
```

O relatório técnico deve conter:

1. Nome do trabalho e componentes.
2. Introdução.
3. Fundamentação teórica.
4. Modelagem dos dados.
5. Arquitetura implementada.
6. Configuração.
7. Resultados experimentais.
8. Discussão.
9. Conclusão.

# Regras de implementação para o Codex

- Não modificar arquivos em `data/raw/`.
- Toda transformação deve escrever em `data/processed/`.
- Todo script deve aceitar argumentos por CLI.
- Usar logs claros.
- Usar batch processing para arquivos grandes.
- Evitar carregar datasets enormes inteiros em memória quando não for necessário.
- Preservar rastreabilidade da fonte original.
- Não commitar `.env`, senhas ou tokens.
- Não inserir credenciais no código.
- Criar `.env.example` sempre que novas variáveis forem necessárias.
- Preferir código simples a abstrações excessivas.
- Documentar qualquer decisão de descarte de registros.
- Manter scripts idempotentes sempre que possível.
- Não depender de interface gráfica para etapas automatizadas.
- Etapas manuais devem ter instruções claras em arquivos `.md`.

## Comandos esperados ao final

```bash
python scripts/inspect_raw_data.py

python scripts/normalize_events.py \
  --raw-dir data/raw \
  --out data/processed/events_normalized.jsonl

python scripts/build_benchmark_datasets.py \
  --input data/processed/events_normalized.jsonl \
  --out-dir data/processed/benchmarks

docker compose -f docker/docker-compose.yml up -d

python scripts/create_indexes.py

python scripts/load_mongo.py \
  --dataset data/processed/benchmarks/events_100000.jsonl \
  --drop

python scripts/run_queries.py --query stats-tipo

python scripts/run_experiments.py
```

## Definição de pronto

O projeto estará pronto quando:

- A pipeline raw estiver documentada.
- O dataset normalizado tiver pelo menos 100.000 registros, se possível.
- Os três recortes de benchmark existirem.
- O MongoDB replica set com 3 nós estiver funcionando.
- As consultas obrigatórias estiverem implementadas.
- Os experimentos tiverem sido executados e salvos.
- A falha de nó tiver sido demonstrada.
- O relatório técnico estiver preenchido com resultados reais.
