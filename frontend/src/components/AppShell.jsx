import { NavLink } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  Database,
  Gauge,
  Home,
  Map,
  Server,
  Table2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Inicio', icon: Home, description: 'Visao geral' },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3, description: 'Metricas agregadas' },
  { to: '/events', label: 'Eventos', icon: Table2, description: 'Tabela e filtros' },
  { to: '/map', label: 'Mapa', icon: Map, description: 'Eventos georreferenciados' },
  { to: '/benchmark', label: 'Benchmark', icon: Gauge, description: 'Resultados experimentais' },
  { to: '/nodes', label: 'Nos', icon: Server, description: 'Replica set' },
]

function DesktopNavLink({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
          'h-9 justify-start px-2.5',
          isActive && 'border border-border bg-secondary',
        )
      }
    >
      <Icon data-icon="inline-start" />
      <span>{item.label}</span>
    </NavLink>
  )
}

function MobileNavLink({ item }) {
  const Icon = item.icon
  return (
    <Tooltip>
      <TooltipTrigger>
        <NavLink
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'icon-sm' }),
              isActive && 'border border-border bg-secondary',
            )
          }
          aria-label={item.label}
        >
          <Icon />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent>{item.label}</TooltipContent>
    </Tooltip>
  )
}

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Database />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Eventos Urbanos</p>
            <p className="truncate text-xs text-muted-foreground">MongoDB replica set</p>
          </div>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => (
            <DesktopNavLink key={item.to} item={item} />
          ))}
        </nav>
        <Separator />
        <div className="flex flex-col gap-3 p-4">
          <Badge variant="outline" className="w-fit">
            <Activity data-icon="inline-start" />
            rs0 ativo
          </Badge>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Base documental para consultas geograficas, temporais e experimentos de tolerancia a falhas.
          </p>
        </div>
      </aside>

      <div className="md:pl-64">
        <main className="min-h-screen overflow-x-hidden pb-16 md:pb-0">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-center border-t bg-background/95 px-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-1">
            {NAV.map((item) => (
              <MobileNavLink key={item.to} item={item} />
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
