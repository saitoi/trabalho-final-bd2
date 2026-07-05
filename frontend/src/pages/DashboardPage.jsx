import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  Crosshair,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Siren,
  Users,
} from 'lucide-react'
import {
  getStatsByCity,
  getStatsByNeighborhood,
  getStatsByReporter,
  getStatsBySeverity,
  getStatsByState,
  getStatsByType,
  getStatsSummary,
  getStatsTemporal,
} from '@/api'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const EVENT_COLORS = [
  'var(--primary)',
  'var(--accent)',
  'hsl(205 52% 36%)',
  'hsl(4 68% 40%)',
  'hsl(270 28% 42%)',
  'hsl(92 25% 34%)',
  'hsl(24 45% 39%)',
]

const SEVERITY_LEVELS = [
  { level: 1, label: 'Baixa', color: 'hsl(150 34% 36%)' },
  { level: 2, label: 'Leve', color: 'hsl(92 25% 34%)' },
  { level: 3, label: 'Moderada', color: 'hsl(43 65% 38%)' },
  { level: 4, label: 'Alta', color: 'hsl(24 60% 40%)' },
  { level: 5, label: 'Critica', color: 'hsl(4 68% 40%)' },
]

const chartConfig = {
  total: { label: 'Eventos', color: 'var(--primary)' },
  gravidade: { label: 'Gravidade', color: 'var(--accent)' },
}

function formatInt(value) {
  return Number(value ?? 0).toLocaleString('pt-BR')
}

function formatDecimal(value, digits = 1) {
  if (value == null) return '-'
  return Number(value).toLocaleString('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function normalizeGroup(rows) {
  return (rows ?? []).map((row, index) => ({
    name: row._id ?? 'N/D',
    total: row.total ?? 0,
    fill: EVENT_COLORS[index % EVENT_COLORS.length],
  }))
}

function normalizeSeverity(rows) {
  const totals = new Map((rows ?? []).map((row) => [Number(row._id), row.total ?? 0]))
  return SEVERITY_LEVELS.map((item) => ({
    ...item,
    name: `Gravidade ${item.level}`,
    total: totals.get(item.level) ?? 0,
    fill: item.color,
  }))
}

function MetricCard({ title, value, description, icon: Icon }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardDescription>{title}</CardDescription>
          <CardTitle className="truncate text-2xl">{value}</CardTitle>
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

function LoadingDashboard() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [summary, byType, byNeighborhood, temporal, severity, states, cities, reporters] =
        await Promise.all([
          getStatsSummary(),
          getStatsByType(),
          getStatsByNeighborhood(),
          getStatsTemporal(),
          getStatsBySeverity(),
          getStatsByState(),
          getStatsByCity(),
          getStatsByReporter(),
        ])
      setData({
        summary: summary.data,
        byType: normalizeGroup(byType.data),
        byNeighborhood: normalizeGroup(byNeighborhood.data).slice(0, 12),
        temporal: normalizeGroup(temporal.data).map((row) => ({ data: row.name, total: row.total })),
        severity: normalizeSeverity(severity.data),
        states: normalizeGroup(states.data).slice(0, 12),
        cities: normalizeGroup(cities.data).slice(0, 12),
        reporters: normalizeGroup(reporters.data).slice(0, 8),
      })
    } catch (err) {
      setError(err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const locationRows = useMemo(() => {
    if (!data) return []
    return data.cities.map((row, index) => ({ ...row, fill: EVENT_COLORS[index % EVENT_COLORS.length] }))
  }, [data])

  if (loading) return <LoadingDashboard />

  if (error || !data) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>API indisponivel</AlertTitle>
          <AlertDescription>
            Verifique se o backend esta rodando em `http://localhost:8000` e tente atualizar.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const { summary } = data
  const metadata = summary.metadata ?? {}
  const dateRange = summary.dateRange ?? {}

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Visao analitica</h2>
            <Badge variant="secondary">{formatInt(summary.total)} eventos</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Recorte operacional da colecao principal com distribuicao por tipo, territorio, gravidade e evolucao diaria.
          </p>
        </div>
        <Button onClick={load} variant="outline">
          <RefreshCw data-icon="inline-start" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Eventos carregados"
          value={formatInt(summary.total)}
          description={`${formatInt(summary.brazil)} registros no Brasil e ${formatInt(summary.rioState)} no RJ.`}
          icon={Siren}
        />
        <MetricCard
          title="Gravidade media"
          value={formatDecimal(summary.avgSeverity)}
          description={`${formatInt(summary.critical)} eventos no nivel 5.`}
          icon={ShieldAlert}
        />
        <MetricCard
          title="Cobertura urbana"
          value={`${formatInt(summary.cities)} cidades`}
          description={`${formatInt(summary.neighborhoods)} bairros identificados.`}
          icon={MapPin}
        />
        <MetricCard
          title="Vitimas registradas"
          value={formatInt(metadata.victims)}
          description={`${formatInt(metadata.dead)} mortos e ${formatInt(metadata.wounded)} feridos nos metadados.`}
          icon={Users}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Eventos por tipo</CardTitle>
            <CardDescription>Taxonomia consolidada usada no modelo canonico.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[360px] w-full">
              <BarChart data={data.byType} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={140} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {data.byType.map((row, index) => (
                    <Cell key={row.name} fill={row.fill ?? EVENT_COLORS[index % EVENT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Severidade</CardTitle>
            <CardDescription>Distribuicao dos eventos entre os niveis 1 a 5.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie data={data.severity} dataKey="total" nameKey="name" innerRadius={70} outerRadius={120}>
                  {data.severity.map((row) => (
                    <Cell key={row.name} fill={row.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-col gap-2">
              {data.severity.map((row) => (
                <div key={row.level} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: row.fill }}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">
                    {row.level} - {row.label}
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    {formatInt(row.total)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolucao temporal</CardTitle>
          <CardDescription>
            {dateRange.min?.slice(0, 10) ?? 'inicio desconhecido'} ate {dateRange.max?.slice(0, 10) ?? 'fim desconhecido'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <LineChart data={data.temporal} margin={{ left: 12, right: 24 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="data" tickLine={false} axisLine={false} minTickGap={36} />
              <YAxis tickLine={false} axisLine={false} width={72} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Tabs defaultValue="territorio" className="gap-3">
        <TabsList variant="line">
          <TabsTrigger value="territorio">Territorio</TabsTrigger>
          <TabsTrigger value="metadados">Metadados</TabsTrigger>
        </TabsList>
        <TabsContent value="territorio">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Cidades com mais registros</CardTitle>
                <CardDescription>Top cidades encontradas na colecao.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[320px] w-full">
                  <BarChart data={locationRows} layout="vertical" margin={{ left: 12, right: 24 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" width={128} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="var(--primary)" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Estados</CardTitle>
                <CardDescription>Distribuicao agregada por UF.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {data.states.slice(0, 8).map((row) => (
                    <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-muted-foreground">{row.name}</span>
                      <Badge variant="secondary">{formatInt(row.total)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="metadados">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Maior FRP"
              value={formatDecimal(metadata.maxFirePower)}
              description="Potencia radiativa maxima nos focos de incendio."
              icon={Crosshair}
            />
            <MetricCard
              title="Risco de fogo medio"
              value={formatDecimal(metadata.avgFireRisk, 2)}
              description="Media calculada quando o campo existe na fonte."
              icon={AlertTriangle}
            />
            <MetricCard
              title="Chuva maxima"
              value={`${formatDecimal(metadata.maxRainMm)} mm`}
              description={`Media observada: ${formatDecimal(metadata.avgRainMm)} mm.`}
              icon={MapPin}
            />
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Reportantes identificados</CardTitle>
              <CardDescription>Distribuicao por identificador publico ou operacional.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.reporters.map((row) => (
                  <div key={row.name} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                    <span className="truncate text-muted-foreground">{row.name}</span>
                    <Badge variant="outline">{formatInt(row.total)}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
