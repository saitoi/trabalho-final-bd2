# Fontes de Dados

## Fontes usadas

- Fogo Cruzado: ocorrências de violência armada, com prioridade para Rio de Janeiro.
- INPE BDQueimadas: focos de queimadas no Brasil.
- INMET: observações meteorológicas anuais, usadas para chuva e risco hidrológico.
- NYC311: fonte internacional usada apenas como fallback de diversidade e volume.
- IBGE e OSM: fontes de apoio espacial e territorial.

## Prioridade

A pipeline prioriza dados reais do Rio de Janeiro, depois Brasil, e só depois bases internacionais. Os samples e benchmarks usam essa mesma ordem.

## Dados sintéticos

Dados sintéticos só são gerados se os dados reais normalizados não alcançarem a carga alvo configurada em `normalize_events.py`. Quando usados, ficam identificados como `origem.fonte = "synthetic_rio"` e preservam metadados de geração acadêmica.

## Arquivos raw

Os arquivos em `dataset/raw/` são imutáveis e não são versionados no Git, exceto `dataset/raw/.gitkeep`.

