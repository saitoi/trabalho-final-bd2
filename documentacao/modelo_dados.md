# Modelo de Dados

## Documento canônico

Cada evento normalizado segue o modelo documental com campos principais:

- `idEvento`
- `tipo`
- `descricao`
- `dataHora`
- `gravidade`
- `status`
- `bairro`, `cidade`, `estado`, `pais`
- `localizacao` em GeoJSON com `[longitude, latitude]`
- `reportante`
- `origem`
- `metadados`

## Categorias consolidadas

Taxonomia usada:

- Tiroteio
- Incêndio
- Alagamento
- Chuva intensa
- Risco hidrológico
- Risco geotécnico
- Problema urbano
- Transporte
- Energia
- Vazamento de água
- Interdição de via
- Outro

## Gravidade

- Fogo Cruzado: 5 para mortos, 4 para feridos/vítimas, 3 para ocorrência sem vítima.
- INPE: 5 para `frp >= 100`, 4 para `frp >= 50` ou risco alto, 3 para foco comum.
- INMET: 5 para precipitação horária >= 50 mm, 4 para >= 25 mm, 3 para >= 10 mm, 2 para chuva fraca.
- NYC311: 2 para casos fechados e 3 para casos abertos.

## Fallback internacional

NYC311 é usado para complementar diversidade real quando fontes brasileiras não cobrem categorias como energia, interdição, vazamento, transporte, alagamento e risco geotécnico. Esses documentos mantêm `pais = "Estados Unidos"` e `metadados.fallbackInternacional = true`.

## Rejeições

Registros sem coordenada válida, data válida ou formato esperado são escritos em `dataset/processed/events_rejected.jsonl` com motivo e origem.
