import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Play, RefreshCw, Server, Square, Terminal, WifiOff } from 'lucide-react'
import { getNodeStatus, startNode, stopNode } from '@/api'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const STEPS = [
  { command: null, text: 'Execute uma consulta agregada e guarde o tempo de resposta.' },
  { command: 'docker stop bd2-mongo2', text: 'Pare um no secundario do replica set.' },
  { command: null, text: 'Atualize esta tela e confirme que o no aparece indisponivel.' },
  { command: null, text: 'Repita a consulta e compare tempo e consistencia.' },
  { command: 'docker start bd2-mongo2', text: 'Restaure o no parado.' },
  { command: null, text: 'Aguarde a sincronizacao e atualize o status novamente.' },
]

function formatUptime(seconds) {
  if (!seconds) return '-'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function memberState(member) {
  if (member.health === 0) return 'DOWN'
  return member.state || 'UNKNOWN'
}

function shortName(member) {
  return member.name?.split(':').pop() ?? member.name
}

function statusVariant(state) {
  if (state === 'PRIMARY') return 'default'
  if (state === 'SECONDARY') return 'secondary'
  if (state === 'DOWN') return 'destructive'
  return 'outline'
}

function NodeCard({ member, pending, onStop, onStart }) {
  const state = memberState(member)
  const Icon = state === 'DOWN' ? WifiOff : state === 'PRIMARY' ? CheckCircle2 : Server
  const isDown = state === 'DOWN'

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardDescription className="truncate font-mono">{member.name}</CardDescription>
          <CardTitle className="mt-1 flex items-center gap-2">
            <Icon />
            {state}
          </CardTitle>
        </div>
        <Badge variant={statusVariant(state)}>{member.health ? 'online' : 'offline'}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-1 rounded-md border p-3">
            <span className="text-muted-foreground">Uptime</span>
            <span className="font-medium">{formatUptime(member.uptime)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-md border p-3">
            <span className="text-muted-foreground">Health</span>
            <span className="font-medium">{member.health ?? '-'}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant={isDown ? 'default' : 'destructive'}
          disabled={pending}
          onClick={isDown ? onStart : onStop}
        >
          {isDown ? <Play data-icon="inline-start" /> : <Square data-icon="inline-start" />}
          {pending ? 'Aguarde...' : isDown ? 'Restaurar no' : 'Parar no'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function NodeStatusPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingNode, setPendingNode] = useState(null)
  const [actionError, setActionError] = useState(null)

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const response = await getNodeStatus()
      setData(response.data)
      return response.data
    } catch (err) {
      const fallback = { ok: false, error: 'Sem conexao com a API', members: [] }
      setData(fallback)
      return fallback
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const runAction = async (name, action, expectDown) => {
    setActionError(null)
    setPendingNode(name)
    try {
      await action(name)
      const deadline = Date.now() + 30000
      let current = await load({ silent: true })
      let changed = false
      while (Date.now() < deadline) {
        const member = current?.members?.find((m) => shortName(m) === name)
        const isDown = !member || member.health === 0
        if (isDown === expectDown) {
          changed = true
          break
        }
        await sleep(1500)
        current = await load({ silent: true })
      }
      if (!changed) {
        setActionError(`O no ${name} ainda nao refletiu a mudanca de estado apos 30s.`)
      }
    } catch (err) {
      setActionError(err?.response?.data?.detail || `Falha ao executar acao no no ${name}`)
    } finally {
      setPendingNode(null)
    }
  }

  const members = useMemo(() => {
    if (data?.members?.length) return data.members
    return [
      { name: 'mongo1:27017', state: 'DOWN', health: 0, uptime: 0 },
      { name: 'mongo2:27017', state: 'DOWN', health: 0, uptime: 0 },
      { name: 'mongo3:27017', state: 'DOWN', health: 0, uptime: 0 },
    ]
  }, [data])

  const primary = members.find((member) => memberState(member) === 'PRIMARY')

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Replica set rs0</h2>
            {primary && <Badge variant="secondary">PRIMARY {primary.name}</Badge>}
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Status reportado pelo comando `rs.status()` via backend FastAPI.
          </p>
        </div>
        <Button onClick={load} variant="outline" disabled={loading}>
          <RefreshCw data-icon="inline-start" className={loading ? 'animate-spin' : undefined} />
          Atualizar
        </Button>
      </div>

      {data && !data.ok && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Cluster indisponivel</AlertTitle>
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Falha na acao</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-44" />)
          : members.map((member) => {
              const name = shortName(member)
              return (
                <NodeCard
                  key={member.name}
                  member={member}
                  pending={pendingNode === name}
                  onStop={() => runAction(name, stopNode, true)}
                  onStart={() => runAction(name, startNode, false)}
                />
              )
            })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal />
            Teste de tolerancia a falhas
          </CardTitle>
          <CardDescription>
            Sequencia usada para demonstrar continuidade da leitura com um no parado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-[44px_minmax(0,1fr)]">
                <div className="flex size-8 items-center justify-center rounded-md bg-secondary text-sm font-medium text-secondary-foreground">
                  {index + 1}
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="text-sm">{step.text}</p>
                  {step.command && (
                    <>
                      <Separator />
                      <code className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
                        {step.command}
                      </code>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
