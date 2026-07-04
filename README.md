# Urban Events Raw Pipeline

Pipeline de extração RAW para o trabalho de BD II.

## Instalação

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edite o `.env`, principalmente `FOGO_CRUZADO_EMAIL` e `FOGO_CRUZADO_PASSWORD`.

## Rodar tudo

```bash
python scripts/extract_raw_all.py
```

## Rodar fontes específicas

```bash
python scripts/extract_raw_all.py --sources fogo_cruzado,inpe_queimadas,ibge
```

## Teste sem baixar

```bash
python scripts/extract_raw_all.py --dry-run
```

## Observações

- Cemaden e Portal Rio 1746 geram pastas de download manual e manifests.
- OSM Geofabrik fica desligado por padrão porque os arquivos são grandes.
- A camada RAW não transforma os dados para o schema final; faça isso em outro script.
