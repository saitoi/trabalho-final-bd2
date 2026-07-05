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
  insert: 'Insercao',
  tipo_incendio: 'Tipo: incendio',
  periodo_2025: 'Periodo 2025',
  raio_centro_rj: 'Raio Centro RJ',
  failure_before: 'Antes da falha',
  failure_after: 'Depois da falha',
}

const chartConfig = {
  seconds: { label: 'Segundos', color: 'var(--primary)' },
  count: { label: 'Registros', color: 'var(--accent)' },
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
  const inserts = rows.filter((row) => row.test === 'insert')
  const queries = rows.filter((row) => !['insert', 'failure_before', 'failure_after'].includes(row.test))
  const failure = payload?.failure
  const largestInsert = inserts.at(-1)

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

  if (error || !payload?.available) {
    return (
      <div className="p-4 md:p-6">
        <Empty className="min-h-96 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database />
            </EmptyMedia>
            <EmptyTitle>Benchmarks indisponiveis</EmptyTitle>
            <EmptyDescription>
              Execute `./pipeline.sh` ou `uv run scripts/run_experiments.py` para gerar `data/processed/experiments/results.json`.
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
            Medicoes gravadas pelos scripts de carga, consulta e falha de no para os recortes de 1.000, 50.000 e 100.000 eventos.
          </p>
        </div>
        <Button onClick={load} variant="outline">
          <RefreshCw data-icon="inline-start" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Maior carga"
          value={formatInt(largestInsert?.count)}
          description={`Inserida em ${formatSeconds(largestInsert?.seconds)}.`}
          icon={Database}
        />
        <MetricCard
          title="Consultas medidas"
          value={formatInt(queries.length)}
          description="Tipo, periodo e raio nos tres volumes."
          icon={Activity}
        />
        <MetricCard
          title="Falha de no"
          value={failure?.consistent ? 'Consistente' : 'Pendente'}
          description={`Depois da falha: ${formatSeconds(failure?.after_seconds)}.`}
          icon={ShieldCheck}
        />
        <MetricCard
          title="Recuperacao"
          value={formatSeconds(failure?.recovery_seconds)}
          description="Tempo observado para restaurar o no parado."
          icon={Clock}
        />
      </div>

      {failure && !failure.skipped && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Resultado consistente apos falha</AlertTitle>
          <AlertDescription>
            A consulta agregada retornou o mesmo total antes e depois da parada de um no: {formatSeconds(failure.before_seconds)} antes e {formatSeconds(failure.after_seconds)} depois.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Tempo de consulta</CardTitle>
            <CardDescription>Comparacao por teste e volume carregado.</CardDescription>
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
            <CardTitle>Insercao por volume</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Tabela de medicoes</CardTitle>
          <CardDescription>Dados brutos do arquivo de resultados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
