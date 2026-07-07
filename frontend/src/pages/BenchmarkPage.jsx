import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, CheckCircle2, Clock, Database, RefreshCw, ShieldCheck } from 'lucide-react'
import { getBenchmarkResults } from '@/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const TEST_LABELS = {
  insert: 'Inserção',
  tipo_incendio: 'Tipo: incêndio',
  periodo_2025: 'Período 2025',
  raio_centro_rj: 'Raio Centro RJ',
  failure_before: 'Antes da falha',
  failure_after: 'Depois da falha',
}

const chartConfig = {
  seconds: { label: 'Segundos', color: 'var(--primary)' },
  count: { label: 'Registros', color: 'var(--accent)' },
  total: { label: 'Eventos', color: 'var(--primary)' },
}

function formatSeconds(value) {
  if (value == null) return '-'
  if (value < 0.01) return `${(value * 1000).toFixed(2)} ms`
  if (value < 1) return `${(value * 1000).toFixed(1)} ms`
  return `${value.toFixed(2)} s`
}

function formatInt(value) {
  return Number(value ?? 0).toLocaleString('pt-BR')
}

function MetricCard({ title, value, description, icon: Icon }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardDescription>{title}</CardDescription>
          <CardTitle className="text-2xl">{value}</CardTitle>
        </div>
        <div className="flex size-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Icon />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export default function BenchmarkPage() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getBenchmarkResults()
      setPayload(response.data)
    } catch (err) {
      setError(err)
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const rows = payload?.results ?? []
  const datasetRows = useMemo(
    () =>
      Object.entries(payload?.datasets ?? {})
        .map(([size, dataset]) => ({
          size: Number(size),
          label: formatInt(size),
          total: dataset.total ?? 0,
          path: dataset.path,
          byType: dataset.by_type ?? {},
          byCountry: dataset.by_country ?? {},
          brazil: dataset.brasil ?? 0,
          rio: dataset.rio_de_janeiro ?? 0,
        }))
        .sort((left, right) => left.size - right.size),
    [payload],
  )
  const inserts = rows.filter((row) => row.test === 'insert')
  const queries = rows.filter((row) => !['insert', 'failure_before', 'failure_after'].includes(row.test))
  const failure = payload?.failure
  const largestInsert = inserts.at(-1)
  const largestDataset = datasetRows.at(-1)
  const benchmarkOnly = rows.length === 0 && datasetRows.length > 0

  const queryChart = useMemo(
    () =>
      queries.map((row) => ({
        ...row,
        name: `${TEST_LABELS[row.test] ?? row.test} · ${formatInt(row.size)}`,
      })),
    [queries],
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <Empty className="min-h-96 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database />
            </EmptyMedia>
            <EmptyTitle>API indisponivel</EmptyTitle>
            <EmptyDescription>
              O frontend nao conseguiu acessar `http://127.0.0.1:8000/benchmarks/results`. Inicie os dois serviços com `./dev.sh` ou reinicie o backend se ele ja estava aberto.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={load} variant="outline">
            <RefreshCw data-icon="inline-start" />
            Atualizar
          </Button>
        </Empty>
      </div>
    )
  }

  if (!payload?.available) {
    return (
      <div className="p-4 md:p-6">
        <Empty className="min-h-96 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database />
            </EmptyMedia>
            <EmptyTitle>Benchmarks indisponiveis</EmptyTitle>
            <EmptyDescription>
              Execute `./pipeline.sh` para gerar `data/processed/benchmarks/summary.json` ou `uv run scripts/run_experiments.py` para gerar `data/processed/experiments/results.json`.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={load} variant="outline">
            <RefreshCw data-icon="inline-start" />
            Atualizar
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Resultados experimentais</h2>
            <Badge variant="secondary">{payload.generated_at?.slice(0, 10) ?? 'sem data'}</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {benchmarkOnly
              ? 'Recortes de benchmark gerados pela pipeline. Execute os experimentos completos para preencher tempos de carga, consulta e falha.'
              : 'Medicoes gravadas pelos scripts de carga, consulta e falha de no para os recortes de 1.000, 50.000 e 100.000 eventos.'}
          </p>
        </div>
        <Button onClick={load} variant="outline">
          <RefreshCw data-icon="inline-start" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title={benchmarkOnly ? 'Maior dataset' : 'Maior carga'}
          value={formatInt(largestInsert?.count ?? largestDataset?.total)}
          description={
            benchmarkOnly
              ? `${datasetRows.length} recortes gerados em data/processed/benchmarks.`
              : `Inserida em ${formatSeconds(largestInsert?.seconds)}.`
          }
          icon={Database}
        />
        <MetricCard
          title="Consultas medidas"
          value={formatInt(queries.length)}
          description={benchmarkOnly ? 'Ainda não executadas.' : 'Tipo, período e raio nos três volumes.'}
          icon={Activity}
        />
        <MetricCard
          title="Falha de nó"
          value={failure?.consistent ? 'Consistente' : 'Pendente'}
          description={`Depois da falha: ${formatSeconds(failure?.after_seconds)}.`}
          icon={ShieldCheck}
        />
        <MetricCard
          title="Recuperação"
          value={formatSeconds(failure?.recovery_seconds)}
          description="Tempo observado para restaurar o nó parado."
          icon={Clock}
        />
      </div>

      {failure && !failure.skipped && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Resultado consistente após falha</AlertTitle>
          <AlertDescription>
            A consulta agregada retornou o mesmo total antes e depois da parada de um no: {formatSeconds(failure.before_seconds)} antes e {formatSeconds(failure.after_seconds)} depois.
          </AlertDescription>
        </Alert>
      )}

      {benchmarkOnly && (
        <Alert>
          <Database />
          <AlertTitle>Datasets prontos, experimentos pendentes</AlertTitle>
          <AlertDescription>
            A pipeline gerou os arquivos de benchmark, mas `data/processed/experiments/results.json` ainda não existe. Rode `RUN_EXPERIMENTS=1 ./pipeline.sh` ou `uv run --script scripts/run_experiments.py` para preencher os tempos.
          </AlertDescription>
        </Alert>
      )}

      {benchmarkOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>Recortes gerados</CardTitle>
            <CardDescription>Volumes disponíveis em `data/processed/benchmarks`.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[360px] w-full">
              <BarChart data={datasetRows} margin={{ left: 8, right: 16 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={84} tickFormatter={formatInt} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="var(--primary)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle>Tempo de consulta</CardTitle>
              <CardDescription>Comparação por teste e volume carregado.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[360px] w-full">
                <BarChart data={queryChart} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" hide />
                  <YAxis tickLine={false} axisLine={false} width={72} tickFormatter={formatSeconds} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatSeconds(value)} />} />
                  <Bar dataKey="seconds" radius={[6, 6, 0, 0]}>
                    {queryChart.map((_, index) => (
                      <Cell key={index} fill={index % 2 === 0 ? 'var(--primary)' : 'var(--accent)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inserção por volume</CardTitle>
              <CardDescription>Tempo total de carga batch.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[360px] w-full">
                <LineChart data={inserts} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="size" tickLine={false} axisLine={false} tickFormatter={formatInt} />
                  <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={formatSeconds} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatSeconds(value)} />} />
                  <Line type="monotone" dataKey="seconds" stroke="var(--primary)" strokeWidth={2} dot />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{benchmarkOnly ? 'Tabela de datasets' : 'Tabela de medições'}</CardTitle>
          <CardDescription>
            {benchmarkOnly ? 'Dados do summary de benchmarks.' : 'Dados brutos do arquivo de resultados.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {benchmarkOnly ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Volume</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Brasil</TableHead>
                    <TableHead>Rio de Janeiro</TableHead>
                    <TableHead>Tipos</TableHead>
                    <TableHead>Caminho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasetRows.map((row) => (
                    <TableRow key={row.size}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell>{formatInt(row.total)}</TableCell>
                      <TableCell>{formatInt(row.brazil)}</TableCell>
                      <TableCell>{formatInt(row.rio)}</TableCell>
                      <TableCell>{Object.keys(row.byType).length}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.path}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teste</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={`${row.test}-${row.size}-${index}`}>
                      <TableCell className="font-medium">{TEST_LABELS[row.test] ?? row.test}</TableCell>
                      <TableCell>{formatInt(row.size)}</TableCell>
                      <TableCell>{formatSeconds(row.seconds)}</TableCell>
                      <TableCell className="text-right">{formatInt(row.count)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
