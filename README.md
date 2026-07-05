# Sistema Distribuído de Monitoramento de Eventos Urbanos — BD II

Projeto acadêmico da disciplina Bancos de Dados II da UFRJ (2026/1).
A solução coleta, normaliza e analisa eventos urbanos brasileiros (tiroteios, incêndios, alagamentos, etc.) a partir de fontes públicas, armazenando-os em um MongoDB Replica Set com 3 nós para experimentos de desempenho e tolerância a falhas. Uma API REST (FastAPI) expõe os dados a um frontend React interativo.

**Integrantes:** Milton Salgado · Pedro Saito · Eduardo Bensabat · Gabriel Guimarães

---

## Requisitos

- `uv` (gerenciador de pacotes Python)
- Docker com Compose
- Python 3.12 (gerenciado pelo `uv`)
- Node.js 18+ e npm (para o frontend)

As dependências Python ficam no `pyproject.toml`. Os scripts também possuem shebang compatível com `uv run --script`.

---

## Pipeline de dados

Para executar o fluxo ponta a ponta em um clone novo:

```bash
./pipeline.sh
```

Se `.env` não existir, o script cria uma cópia de `.env.example` e avisa o usuário. Por padrão ele tenta completar `data/raw/`, rodando extração apenas para fontes ainda ausentes. Fontes manuais geram instruções, e Fogo Cruzado só é baixado se `FOGO_CRUZADO_EMAIL` e `FOGO_CRUZADO_PASSWORD` estiverem preenchidos no `.env`.

```bash
RUN_EXTRACT=1 ./pipeline.sh    # forçar extração
RUN_EXTRACT=0 ./pipeline.sh    # usar dados raw já presentes
RUN_EXPERIMENTS=1 ./pipeline.sh  # incluir experimentos completos
```

### Etapas individuais

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

---

## MongoDB Replica Set

```bash
docker compose -f docker/docker-compose.yml up -d
uv run --script scripts/wait_for_mongo.py
uv run --script scripts/create_indexes.py
```

> **Docker Desktop no Windows:** o `init-replica-set.js` usa os nomes dos serviços Docker
> (`mongo1`, `mongo2`, `mongo3`) em vez de `host.docker.internal`, pois este resolve para
> o IP da rede WiFi e não para `127.0.0.1`. A configuração original está comentada no arquivo.
> A URI da API usa `directConnection=true` pelo mesmo motivo.

### Carga e consultas

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

### Experimentos

```bash
uv run --script scripts/run_experiments.py
```

Mede inserção, consultas nos três volumes (1 K / 50 K / 100 K) e tolerância a falhas com parada/reinício de nó. Use `--skip-failure` para evitar os comandos `docker stop/start`.

---

## Backend — API REST (FastAPI)

A API conecta o frontend ao MongoDB e expõe os dados normalizados via HTTP.

### Instalação

```bash
cd app
pip install -r requirements.txt
```

Ou, a partir da raiz com o ambiente virtual já ativo:

```bash
pip install -r app/requirements.txt
```

### Iniciar a API

```bash
uvicorn app.main:app --reload --port 8000
```

A API sobe em `http://localhost:8000`. Documentação interativa disponível em `/docs`.

### Rotas disponíveis

| Método | Rota | Descrição |
| ------ | ---- | --------- |
| `GET` | `/events` | Lista eventos (filtros: `tipo`, `limit`) |
| `POST` | `/events` | Cadastra novo evento |
| `GET` | `/events/by-period` | Eventos por intervalo de datas |
| `GET` | `/events/by-location` | Eventos por raio geoespacial (`$near`) |
| `GET` | `/events/by-severity` | Eventos por gravidade mínima |
| `GET` | `/stats/by-type` | Contagem agrupada por tipo |
| `GET` | `/stats/by-neighborhood` | Top bairros por volume |
| `GET` | `/stats/temporal` | Série temporal (eventos por dia) |
| `GET` | `/nodes/status` | Status do Replica Set (`replSetGetStatus`) |

---

## Frontend — Interface Web (React)

Dashboard interativo para visualização e análise dos eventos urbanos.

### Stack

- **React 18** + **Vite** — build e dev server
- **Tailwind CSS** — estilização utilitária
- **React-Leaflet** — mapa interativo com marcadores geoespaciais
- **Recharts** — gráficos (BarChart, LineChart com zoom via Brush)
- **framer-motion** — animações de página, componentes e transições
- **lucide-react** — ícones

### Instalação do frontend

```bash
cd frontend
npm install
```

### Iniciar o frontend

```bash
npm run dev
```

O frontend sobe em `http://localhost:5173`. As chamadas `/api/*` são automaticamente proxiadas para `http://localhost:8000` via configuração do Vite — a API precisa estar rodando.

### Páginas

| Rota | Página | Descrição |
| ---- | ------ | --------- |
| `/` | Início | Apresentação do projeto e integrantes |
| `/map` | Mapa | Mapa interativo com filtro por tipo e busca por raio |
| `/dashboard` | Dashboard | Gráficos por tipo, bairro e evolução temporal |
| `/events` | Consulta por período | Tabela paginada com filtro de datas |
| `/new-event` | Novo Evento | Formulário para cadastro manual |
| `/nodes` | Status dos Nós | Estado do Replica Set em tempo real |

### Layout responsivo

- **Desktop (`lg+`):** sidebar lateral colapsável (ícones + rótulos)
- **Mobile:** barra de navegação fixa na base da tela

---

## Estrutura do repositório

```text
.
├── app/                    # Backend FastAPI
│   ├── main.py
│   ├── database.py
│   └── routes/
├── data/
│   ├── raw/                # Dados originais (nunca modificados, não versionados)
│   └── processed/          # Dados transformados (não versionados)
├── docker/                 # Docker Compose + init do Replica Set
├── docs/                   # Documentação interna (não versionada)
├── frontend/               # Frontend React + Vite
│   ├── public/
│   └── src/
│       ├── api/            # Chamadas HTTP (axios)
│       ├── components/     # Sidebar, BottomNav
│       └── pages/          # Uma página por rota
├── scripts/                # Pipeline de dados (extração, normalização, carga, experimentos)
├── CLAUDE.md               # Instruções para Claude Code
├── pipeline.sh             # Script de execução ponta a ponta
└── pyproject.toml          # Dependências Python
```

## Fontes de dados

| Fonte | Descrição |
| ----- | --------- |
| Fogo Cruzado | Violência armada (RJ/PE/BA/PA) — requer credenciais no `.env` |
| INPE BDQueimadas | Detecção de focos de queimada por satélite |
| INMET | Dados meteorológicos históricos |
| IBGE | Limites municipais e dados geográficos |
| OpenStreetMap | Dados geoespaciais via Overpass API |
| NYC 311 | Solicitações de serviço urbano (volume complementar) |
| CEMADEN | Dados hidrológicos — download manual (CAPTCHA) |
| Portal Rio 1746 | Solicitações de serviço do município do Rio — download manual |

Dados sintéticos só são gerados se os registros reais não atingirem a carga alvo, e sempre ficam marcados com `origem.fonte = "synthetic_rio"`.
