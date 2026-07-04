# Sistema Distribuído de Monitoramento e Análise de Eventos Urbanos

## 1. Nome do trabalho e componentes

Sistema Distribuído de Monitoramento e Análise de Eventos Urbanos. Componentes do grupo devem ser preenchidos antes da entrega.

## 2. Introdução

O projeto implementa uma aplicação para armazenar, consultar e analisar eventos urbanos usando banco NoSQL distribuído. O foco é demonstrar modelagem documental, consultas geográficas, agregações, replicação e tolerância a falhas.

## 3. Fundamentação teórica

O MongoDB foi escolhido por seu modelo documental, suporte nativo a índices geoespaciais `2dsphere`, agregações e replica set. Um replica set mantém cópias dos dados em múltiplos nós e permite continuidade de leitura/escrita quando um nó secundário fica indisponível.

## 4. Modelagem dos dados

Os eventos são documentos JSON com dados temporais, espaciais, categoria consolidada, gravidade, status, reportante e rastreabilidade da fonte. A localização usa GeoJSON para permitir consultas por raio.

## 5. Arquitetura implementada

A arquitetura separa dados brutos, dados processados e banco. Scripts CLI fazem inventário, normalização, geração de benchmarks, carga no MongoDB, criação de índices, consultas e experimentos.

## 6. Configuração

O ambiente distribuído usa Docker Compose com três nós MongoDB no replica set `rs0`. Os scripts usam `uv` e variáveis em `.env.example`.

## 7. Resultados experimentais

A preparação dos dados produziu 152.650 eventos normalizados reais. Os recortes de benchmark foram gerados com 1.000, 50.000 e 100.000 registros. No recorte de 100.000 eventos, 82.262 registros são do Brasil. Dados sintéticos não foram necessários, pois os dados reais disponíveis superaram a carga alvo.

Os experimentos no MongoDB replica set produziram os seguintes tempos:

| Teste | 1.000 registros | 50.000 registros | 100.000 registros |
| --- | ---: | ---: | ---: |
| Inserção | 0,063 s | 4,145 s | 8,836 s |
| Consulta por tipo `Incêndio` | 0,001 s | 0,010 s | 0,026 s |
| Consulta por período 2025 | 0,001 s | 0,002 s | 0,003 s |
| Consulta geográfica Centro-RJ, 5 km | 0,001 s | 0,046 s | 0,103 s |

No teste de falha, a agregação por tipo retornou 100.000 registros antes e depois de parar `mongo2`. O tempo subiu de 0,108 s para 0,176 s e os resultados permaneceram consistentes. Após religar o nó, a recuperação observada foi de 5,008 s.

## 8. Discussão

A solução prioriza fontes reais brasileiras e do Rio de Janeiro. Dados internacionais e sintéticos são tratados como fallback, com origem explícita, para não comprometer a rastreabilidade.

## 9. Conclusão

O sistema atende aos requisitos de inserção, consultas por tipo, período, localização e gravidade, estatísticas agregadas, replicação com três nós e demonstração de tolerância a falhas.
