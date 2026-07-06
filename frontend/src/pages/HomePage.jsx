import { Link } from 'react-router-dom'
import {
  BarChart3,
  Database,
  Gauge,
  GraduationCap,
  Map,
  Server,
  ShieldCheck,
  Table2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const MEMBERS = [
  { name: 'Milton Salgado', dre: '122169279' },
  { name: 'Pedro Saito', dre: '122149392' },
  { name: 'Eduardo Bensabat', dre: '122149392' },
  { name: 'Gabriel Guimaraes', dre: '122137997' },
]

const WORKFLOW = [
  { title: 'Normalizacao', icon: Database, text: 'Eventos urbanos no modelo documental canonico.' },
  { title: 'Consulta', icon: Table2, text: 'Filtros por tipo, periodo, severidade e localizacao.' },
  { title: 'Analise', icon: BarChart3, text: 'Agregacoes por territorio, gravidade e tempo.' },
  { title: 'Experimento', icon: Gauge, text: 'Carga de 1k, 50k e 100k registros com falha de no.' },
]

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-[360px] flex-col justify-between rounded-lg border bg-card p-6 md:p-8">
          <div className="flex flex-col gap-5">
            <Badge variant="outline" className="w-fit">
              <GraduationCap data-icon="inline-start" />
              UFRJ · Bancos de Dados II
            </Badge>
            <div className="flex max-w-4xl flex-col gap-4">
              <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Sistema Distribuido de Monitoramento e Analise de Eventos Urbanos
              </h2>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                Aplicacao documental sobre MongoDB replica set para consultar ocorrencias reais de eventos urbanos, analisar distribuicao geografica e registrar experimentos de desempenho.
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/events" className={cn(buttonVariants({ size: 'lg' }))}>
              <Table2 data-icon="inline-start" />
              Ver eventos
            </Link>
            <Link to="/dashboard" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
              <BarChart3 data-icon="inline-start" />
              Abrir dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardDescription>Banco distribuido</CardDescription>
              <CardTitle className="flex items-center gap-2">
                <Server />
                3 nos MongoDB
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Replica set `rs0` usado para demonstrar replicacao, leitura apos falha e recuperacao.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Base principal</CardDescription>
              <CardTitle className="flex items-center gap-2">
                <Map />
                GeoJSON 2dsphere
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coordenadas em `[longitude, latitude]` para buscas por raio e visualizacao no mapa.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Pronto para avaliacao</CardDescription>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck />
                Benchmarks reais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Experimentos salvos em arquivo e expostos pela API para auditoria direta na interface.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {WORKFLOW.map(({ title, icon: Icon, text }) => (
          <Card key={title}>
            <CardHeader>
              <div className="flex size-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <Icon />
              </div>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Integrantes</h3>
          <p className="text-sm text-muted-foreground">Turma de Bancos de Dados II · UFRJ 2026/1</p>
        </div>
        <Separator className="my-4" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MEMBERS.map((member) => (
            <div key={`${member.name}-${member.dre}`} className="flex flex-col gap-1 rounded-md border bg-background p-3">
              <span className="text-sm font-medium">{member.name}</span>
              <span className="text-xs text-muted-foreground">DRE {member.dre}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
