import { useEffect, useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react'
import { createEvent, getEventFilterOptions, searchEvents } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const TIPOS = [
  'Tiroteio',
  'Incêndio',
  'Alagamento',
  'Chuva intensa',
  'Risco hidrológico',
  'Risco geotécnico',
  'Problema urbano',
  'Transporte',
  'Energia',
  'Vazamento de água',
  'Interdição de via',
  'Outro',
]

const STATUS = ['Aberto', 'Em andamento', 'Resolvido', 'Fechado']

const DOCUMENT_FIELDS = [
  { value: 'descricao', label: 'descricao' },
  { value: 'origem.fonte', label: 'origem.fonte' },
  { value: 'origem.idOriginal', label: 'origem.idOriginal' },
  { value: 'origem.arquivoRaw', label: 'origem.arquivoRaw' },
  { value: 'reportante.tipo', label: 'reportante.tipo' },
  { value: 'reportante.identificador', label: 'reportante.identificador' },
  { value: 'metadados.categoriaOriginal', label: 'metadados.categoriaOriginal' },
  { value: 'metadados.extraidoEm', label: 'metadados.extraidoEm' },
  { value: 'metadados.linhaOriginal', label: 'metadados.linhaOriginal' },
]

const DOCUMENT_OPERATORS = [
  { value: 'contains', label: 'Contem' },
  { value: 'equals', label: 'Igual a' },
]

const EMPTY_LOCATION_OPTIONS = {
  bairros: [],
}

const CONTROL_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

function nowForInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function blankForm() {
  return {
    tipo: 'Problema urbano',
    descricao: '',
    dataHora: nowForInput(),
    gravidade: 3,
    status: 'Aberto',
    bairro: '',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    pais: 'Brasil',
    latitude: '-22.9068',
    longitude: '-43.1729',
  }
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16)
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function cleanFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value != null),
  )
}

function severityVariant(value) {
  if (value >= 5) return 'destructive'
  if (value >= 3) return 'secondary'
  return 'outline'
}

export default function EventListPage() {
  const [draft, setDraft] = useState({
    q: '',
    tipo: '',
    bairro: '',
    status: '',
    minGravidade: '',
    maxGravidade: '',
    inicio: '',
    fim: '',
    documentField: '',
    documentOperator: 'contains',
    documentValue: '',
  })
  const [filters, setFilters] = useState({})
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sorting, setSorting] = useState([{ id: 'dataHora', desc: true }])
  const [loading, setLoading] = useState(true)
  const [filterOptions, setFilterOptions] = useState(EMPTY_LOCATION_OPTIONS)
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const sort = sorting[0] ?? { id: 'dataHora', desc: true }
      const params = {
        ...filters,
        page,
        pageSize,
        sortBy: sort.id,
        sortDir: sort.desc ? 'desc' : 'asc',
      }
      const response = await searchEvents(params)
      setEvents(response.data.items ?? [])
      setTotal(response.data.total ?? 0)
    } catch (err) {
      setEvents([])
      setTotal(0)
      toast.error('Nao foi possivel carregar os eventos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filters, page, pageSize, sorting])

  useEffect(() => {
    let active = true

    const loadFilterOptions = async () => {
      setFilterOptionsLoading(true)
      try {
        const response = await getEventFilterOptions()
        if (active) {
          setFilterOptions({ bairros: response.data.bairros ?? [] })
        }
      } catch (err) {
        if (active) {
          setFilterOptions(EMPTY_LOCATION_OPTIONS)
          toast.error('Nao foi possivel carregar as opcoes de localizacao')
        }
      } finally {
        if (active) {
          setFilterOptionsLoading(false)
        }
      }
    }

    loadFilterOptions()

    return () => {
      active = false
    }
  }, [])

  const columns = useMemo(
    () => [
      {
        accessorKey: 'idEvento',
        header: 'ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.idEvento ?? 'manual'}
          </span>
        ),
      },
      {
        accessorKey: 'tipo',
        header: 'Tipo',
        cell: ({ row }) => <span className="font-medium">{row.original.tipo}</span>,
      },
      {
        accessorKey: 'cidade',
        header: 'Cidade',
        cell: ({ row }) => (
          <div className="flex max-w-56 flex-col">
            <span className="truncate">{row.original.cidade}</span>
            <span className="truncate text-xs text-muted-foreground">{row.original.bairro || row.original.estado || '-'}</span>
          </div>
        ),
      },
      {
        accessorKey: 'gravidade',
        header: 'Grav.',
        cell: ({ row }) => (
          <Badge variant={severityVariant(row.original.gravidade)}>
            {row.original.gravidade}
          </Badge>
        ),
      },
      {
        accessorKey: 'dataHora',
        header: 'Data',
        cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.dataHora)}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant="outline">{row.original.status || '-'}</Badge>,
      },
    ],
    [],
  )

  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    state: { sorting },
    onSortingChange: setSorting,
  })

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const applyFilters = (event) => {
    event.preventDefault()
    setPage(1)
    const next = cleanFilters(draft)
    if (!draft.documentField || !draft.documentValue) {
      delete next.documentField
      delete next.documentOperator
      delete next.documentValue
    }
    setFilters(next)
  }

  const resetFilters = () => {
    const next = {
      q: '',
      tipo: '',
      bairro: '',
      status: '',
      minGravidade: '',
    maxGravidade: '',
      inicio: '',
      fim: '',
      documentField: '',
      documentOperator: 'contains',
      documentValue: '',
    }
    setDraft(next)
    setFilters({})
    setPage(1)
  }

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submitEvent = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const lat = Number(form.latitude)
      const lon = Number(form.longitude)
      const dataHora = form.dataHora.length === 16 ? `${form.dataHora}:00-03:00` : form.dataHora
      await createEvent({
        idEvento: `WEB-${Date.now()}`,
        tipo: form.tipo,
        descricao: form.descricao || null,
        dataHora,
        gravidade: Number(form.gravidade),
        status: form.status,
        bairro: form.bairro || null,
        cidade: form.cidade,
        estado: form.estado || null,
        pais: form.pais || 'Brasil',
        localizacao: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        reportante: {
          tipo: 'Cadastro manual',
          identificador: 'Interface web',
        },
        origem: {
          idOriginal: null,
          arquivoRaw: null,
        },
        metadados: {
          extraidoEm: new Date().toISOString(),
        },
      })
      toast.success('Evento cadastrado')
      setDialogOpen(false)
      setForm(blankForm())
      load()
    } catch (err) {
      toast.error('Nao foi possivel cadastrar o evento')
    } finally {
      setSaving(false)
    }
  }

  const openEventDocument = (event) => {
    setSelectedEvent(event)
  }

  const handleRowKeyDown = (keyboardEvent, event) => {
    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
      keyboardEvent.preventDefault()
      openEventDocument(event)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Eventos</h2>
            <Badge variant="secondary">{total.toLocaleString('pt-BR')} resultados</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Tabela completa por padrao, com filtros opcionais para refinar a consulta sem trocar de tela.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus data-icon="inline-start" />
          Novo evento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Use um ou mais campos. Sem filtros, a API retorna a colecao paginada.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilters}>
            <FieldGroup className="gap-4">
              <div className="grid gap-3 lg:grid-cols-12">
                <Field className="lg:col-span-4">
                  <FieldLabel htmlFor="q">Busca</FieldLabel>
                  <Input
                    id="q"
                    placeholder="ID, tipo, cidade, bairro..."
                    value={draft.q}
                    onChange={(event) => updateDraft('q', event.target.value)}
                  />
                </Field>
                <Field className="lg:col-span-3">
                  <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
                  <select
                    id="tipo"
                    className={CONTROL_CLASS}
                    value={draft.tipo}
                    onChange={(event) => updateDraft('tipo', event.target.value)}
                  >
                    <option value="">Todos</option>
                    {TIPOS.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </Field>
                <Field className="lg:col-span-2">
                  <FieldLabel htmlFor="status">Status</FieldLabel>
                  <select
                    id="status"
                    className={CONTROL_CLASS}
                    value={draft.status}
                    onChange={(event) => updateDraft('status', event.target.value)}
                  >
                    <option value="">Todos</option>
                    {STATUS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </Field>
                <Field className="lg:col-span-3">
                  <FieldLabel>Gravidade (min/max)</FieldLabel>
                  <div className="flex gap-2">
                    <select
                      id="minGravidade"
                      aria-label="Gravidade minima"
                      className={CONTROL_CLASS}
                      value={draft.minGravidade}
                      onChange={(event) => updateDraft('minGravidade', event.target.value)}
                    >
                      <option value="">Min</option>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <select
                      id="maxGravidade"
                      aria-label="Gravidade maxima"
                      className={CONTROL_CLASS}
                      value={draft.maxGravidade}
                      onChange={(event) => updateDraft('maxGravidade', event.target.value)}
                    >
                      <option value="">Max</option>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                </Field>
              </div>

              <FieldSeparator>Localizacao e periodo</FieldSeparator>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                <Field className="lg:col-span-6">
                  <FieldLabel htmlFor="bairro">Bairro</FieldLabel>
                  <select
                    id="bairro"
                    className={CONTROL_CLASS}
                    value={draft.bairro}
                    disabled={filterOptionsLoading && filterOptions.bairros.length === 0}
                    onChange={(event) => updateDraft('bairro', event.target.value)}
                  >
                    <option value="">Todos</option>
                    {filterOptions.bairros.map((bairro) => (
                      <option key={bairro} value={bairro}>{bairro}</option>
                    ))}
                  </select>
                </Field>
                <Field className="lg:col-span-3">
                  <FieldLabel htmlFor="inicio">Inicio</FieldLabel>
                  <Input id="inicio" type="date" value={draft.inicio} onChange={(event) => updateDraft('inicio', event.target.value)} />
                </Field>
                <Field className="lg:col-span-3">
                  <FieldLabel htmlFor="fim">Fim</FieldLabel>
                  <Input id="fim" type="date" value={draft.fim} onChange={(event) => updateDraft('fim', event.target.value)} />
                </Field>
              </div>

              <FieldSeparator>Documento</FieldSeparator>

              <div className="grid gap-3 lg:grid-cols-12">
                <Field className="lg:col-span-5">
                  <FieldLabel htmlFor="documentField">Campo</FieldLabel>
                  <select
                    id="documentField"
                    className={CONTROL_CLASS}
                    value={draft.documentField}
                    onChange={(event) => updateDraft('documentField', event.target.value)}
                  >
                    <option value="">Nenhum</option>
                    {DOCUMENT_FIELDS.map((field) => (
                      <option key={field.value} value={field.value}>{field.label}</option>
                    ))}
                  </select>
                </Field>
                <Field className="lg:col-span-2">
                  <FieldLabel htmlFor="documentOperator">Operador</FieldLabel>
                  <select
                    id="documentOperator"
                    className={CONTROL_CLASS}
                    value={draft.documentOperator}
                    onChange={(event) => updateDraft('documentOperator', event.target.value)}
                  >
                    {DOCUMENT_OPERATORS.map((operator) => (
                      <option key={operator.value} value={operator.value}>{operator.label}</option>
                    ))}
                  </select>
                </Field>
                <Field className="lg:col-span-5">
                  <FieldLabel htmlFor="documentValue">Valor</FieldLabel>
                  <Input
                    id="documentValue"
                    placeholder="Ex.: INPE, manual, queimada..."
                    value={draft.documentValue}
                    onChange={(event) => updateDraft('documentValue', event.target.value)}
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <FieldDescription>
                  Ordenacao nos cabecalhos da tabela; paginacao executada no backend.
                </FieldDescription>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    <RotateCcw data-icon="inline-start" />
                    Limpar
                  </Button>
                  <Button type="submit">
                    <Search data-icon="inline-start" />
                    Filtrar
                  </Button>
                </div>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sorted = header.column.getIsSorted()
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder ? null : (
                            <button
                              type="button"
                              className={cn(
                                'inline-flex items-center gap-1 text-left',
                                header.column.getCanSort() && 'cursor-pointer',
                              )}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sorted === 'asc' && <ArrowUp />}
                              {sorted === 'desc' && <ArrowDown />}
                            </button>
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading &&
                  Array.from({ length: pageSize }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={columns.length}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}

                {!loading &&
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer"
                      onClick={() => openEventDocument(row.original)}
                      onKeyDown={(event) => handleRowKeyDown(event, row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          {!loading && events.length === 0 && (
            <Empty className="m-4 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>Nenhum evento encontrado</EmptyTitle>
                <EmptyDescription>Remova filtros ou carregue outro recorte no MongoDB.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {first.toLocaleString('pt-BR')} a {last.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Eventos por pagina"
            className={cn(CONTROL_CLASS, 'w-28')}
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              setPage(1)
            }}
          >
            {[10, 25, 50, 100, 200].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <ChevronLeft data-icon="inline-start" />
            Anterior
          </Button>
          <Badge variant="outline">{page} / {pageCount}</Badge>
          <Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
            Proxima
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cadastrar evento</DialogTitle>
            <DialogDescription>
              Registro manual no mesmo modelo documental usado pela pipeline.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEvent} className="flex flex-col gap-5">
            <FieldGroup>
              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="form-tipo">Tipo</FieldLabel>
                  <select
                    id="form-tipo"
                    className={CONTROL_CLASS}
                    value={form.tipo}
                    onChange={(event) => updateForm('tipo', event.target.value)}
                  >
                    {TIPOS.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="form-gravidade">Gravidade</FieldLabel>
                  <Input
                    id="form-gravidade"
                    type="number"
                    min="1"
                    max="5"
                    value={form.gravidade}
                    onChange={(event) => updateForm('gravidade', event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="form-status">Status</FieldLabel>
                  <select
                    id="form-status"
                    className={CONTROL_CLASS}
                    value={form.status}
                    onChange={(event) => updateForm('status', event.target.value)}
                  >
                    {STATUS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="form-descricao">Descricao</FieldLabel>
                <Textarea
                  id="form-descricao"
                  value={form.descricao}
                  onChange={(event) => updateForm('descricao', event.target.value)}
                  placeholder="Resumo objetivo da ocorrencia"
                />
              </Field>

              <div className="grid gap-3 md:grid-cols-4">
                <Field>
                  <FieldLabel htmlFor="form-data">Data e hora</FieldLabel>
                  <Input
                    id="form-data"
                    type="datetime-local"
                    value={form.dataHora}
                    onChange={(event) => updateForm('dataHora', event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="form-bairro">Bairro</FieldLabel>
                  <select
                    id="form-bairro"
                    className={CONTROL_CLASS}
                    value={form.bairro}
                    disabled={filterOptionsLoading && filterOptions.bairros.length === 0}
                    onChange={(event) => updateForm('bairro', event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {filterOptions.bairros.map((bairro) => (
                      <option key={bairro} value={bairro}>{bairro}</option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="form-lat">Latitude</FieldLabel>
                  <Input
                    id="form-lat"
                    type="number"
                    step="0.000001"
                    value={form.latitude}
                    onChange={(event) => updateForm('latitude', event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="form-lon">Longitude</FieldLabel>
                  <Input
                    id="form-lon"
                    type="number"
                    step="0.000001"
                    value={form.longitude}
                    onChange={(event) => updateForm('longitude', event.target.value)}
                    required
                  />
                </Field>
              </div>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
                Cadastrar evento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedEvent != null} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Documento MongoDB</DialogTitle>
            <DialogDescription>
              {selectedEvent?.idEvento ?? selectedEvent?.tipo ?? 'Evento selecionado'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
              <code>{JSON.stringify(selectedEvent, null, 2)}</code>
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
