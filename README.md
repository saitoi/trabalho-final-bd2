# Urban Events Raw Pipeline

Pipeline de extração RAW para o trabalho de BD II.

## Instalação

```bash
# baixe uv
# unix: curl -LsSf https://astral.sh/uv/install.sh | sh
# windows: consulte https://docs.astral.sh/uv/getting-started/installation/#__tabbed_1_2
uv sync
```

Edite o `.env`, adicione `FOGO_CRUZADO_EMAIL` e `FOGO_CRUZADO_PASSWORD`.

## Rodar tudo

```bash
uv run scripts/extract_raw_all.py
```

## Rodar fontes específicas

```bash
uv run scripts/extract_raw_all.py --sources fogo_cruzado,inpe_queimadas,ibge
```

## Teste sem baixar

```bash
uv run scripts/extract_raw_all.py --dry-run
```

## Observações

- Cemaden e Portal Rio 1746 geram pastas de download manual e manifests.
- OSM Geofabrik fica desligado por padrão porque os arquivos são grandes.
- A camada RAW não transforma os dados para o schema final; faça isso em outro script.
