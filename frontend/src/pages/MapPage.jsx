import { useEffect, useMemo, useState } from 'react'
import Map, { Layer, Marker, Popup, Source } from 'react-map-gl/maplibre'
import { Filter, LocateFixed, MapPin, RotateCcw, Search } from 'lucide-react'
import { getEvents, getEventsByLocation } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'

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

const TYPE_COLORS = {
  Tiroteio: '#b42318',
  Incêndio: '#c2410c',
  Alagamento: '#1d4ed8',
  'Chuva intensa': '#4338ca',
  'Risco hidrológico': '#0f766e',
  'Risco geotécnico': '#7c3aed',
  'Problema urbano': '#525252',
  Transporte: '#a16207',
  Energia: '#ca8a04',
  'Vazamento de água': '#0891b2',
  'Interdição de via': '#4d7c0f',
  Outro: '#737373',
}

const CONTROL_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring'

function circleFeature(center, radiusKm) {
  if (!center) return null
  const points = 96
  const coords = []
  const lat = center.lat
  const lon = center.lon
  const latRadius = radiusKm / 110.574
  const lonRadius = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))

  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2
    coords.push([lon + lonRadius * Math.cos(angle), lat + latRadius * Math.sin(angle)])
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {},
      },
    ],
  }
}

function eventPosition(event) {
  const coordinates = event.localizacao?.coordinates
  if (!coordinates || coordinates.length !== 2) return null
  return { lon: coordinates[0], lat: coordinates[1] }
}

export default function MapPage() {
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState(null)
  const [tipo, setTipo] = useState('')
  const [radiusKm, setRadiusKm] = useState(5)
  const [center, setCenter] = useState(null)
  const [selectingCenter, setSelectingCenter] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadEvents = async (nextTipo = tipo) => {
    setLoading(true)
    setSelected(null)
    try {
      const response = await getEvents({ tipo: nextTipo || undefined, limit: 1000 })
      setEvents(response.data ?? [])
    } catch (err) {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents(tipo)
  }, [tipo])

  const radiusData = useMemo(() => circleFeature(center, radiusKm), [center, radiusKm])

  const searchRadius = async () => {
    if (!center) return
    setLoading(true)
    setSelected(null)
    try {
      const response = await getEventsByLocation(center.lat, center.lon, radiusKm)
      setEvents(response.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  const resetRadius = () => {
    setCenter(null)
    setSelectingCenter(false)
    loadEvents(tipo)
  }

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <Map
        initialViewState={{
          longitude: -43.1729,
          latitude: -22.9068,
          zoom: 10.5,
        }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        style={{ width: '100%', height: '100%' }}
        onClick={(event) => {
          if (!selectingCenter) return
          setCenter({ lat: event.lngLat.lat, lon: event.lngLat.lng })
          setSelectingCenter(false)
        }}
      >
        {radiusData && (
          <Source id="radius-search" type="geojson" data={radiusData}>
            <Layer
              id="radius-search-fill"
              type="fill"
              paint={{ 'fill-color': '#0f766e', 'fill-opacity': 0.12 }}
            />
            <Layer
              id="radius-search-line"
              type="line"
              paint={{ 'line-color': '#0f766e', 'line-width': 2 }}
            />
          </Source>
        )}

        {center && (
          <Marker longitude={center.lon} latitude={center.lat} anchor="center">
            <div className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg">
              <LocateFixed />
            </div>
          </Marker>
        )}

        {events.map((event, index) => {
          const position = eventPosition(event)
          if (!position) return null
          const color = TYPE_COLORS[event.tipo] ?? TYPE_COLORS.Outro
          return (
            <Marker
              key={event.idEvento ?? index}
              longitude={position.lon}
              latitude={position.lat}
              anchor="center"
              onClick={(markerEvent) => {
                markerEvent.originalEvent.stopPropagation()
                setSelected(event)
              }}
            >
              <button
                type="button"
                className="block size-3.5 rounded-full border-2 border-background shadow-md transition-transform hover:scale-125"
                style={{ backgroundColor: color }}
                aria-label={event.tipo}
              />
            </Marker>
          )
        })}

        {selected && eventPosition(selected) && (
          <Popup
            longitude={eventPosition(selected).lon}
            latitude={eventPosition(selected).lat}
            anchor="top"
            closeOnClick={false}
            onClose={() => setSelected(null)}
          >
            <div className="flex max-w-72 flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[selected.tipo] ?? TYPE_COLORS.Outro }}
                />
                <strong>{selected.tipo}</strong>
              </div>
              {selected.descricao && <p className="text-muted-foreground">{selected.descricao}</p>}
              <div className="flex flex-wrap gap-2">
                <Badge variant={selected.gravidade >= 5 ? 'destructive' : 'secondary'}>
                  Gravidade {selected.gravidade}
                </Badge>
                <Badge variant="outline">{selected.status || 'Sem status'}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {[selected.bairro, selected.cidade, selected.estado].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-muted-foreground">{selected.dataHora?.slice(0, 16) ?? '-'}</p>
            </div>
          </Popup>
        )}
      </Map>

      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-3 lg:inset-x-auto lg:left-4 lg:w-[360px]">
        <Card className="pointer-events-auto">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="flex items-center gap-2">
                  <Filter />
                  Filtros do mapa
                </CardTitle>
                <CardDescription>{events.length.toLocaleString('pt-BR')} eventos exibidos</CardDescription>
              </div>
              {loading && <Skeleton className="h-8 w-20" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="map-tipo">Tipo de evento</FieldLabel>
                <select
                  id="map-tipo"
                  className={CONTROL_CLASS}
                  value={tipo}
                  onChange={(event) => setTipo(event.target.value)}
                >
                  <option value="">Todos</option>
                  {TIPOS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Field>

              <Field>
                <FieldLabel htmlFor="radius">Busca por raio</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    id="radius"
                    type="range"
                    min="1"
                    max="100"
                    value={radiusKm}
                    onChange={(event) => setRadiusKm(Number(event.target.value))}
                    className="w-full accent-[var(--primary)]"
                  />
                  <Badge variant="outline">{radiusKm} km</Badge>
                </div>
                <FieldDescription>
                  {center
                    ? `${center.lat.toFixed(4)}, ${center.lon.toFixed(4)}`
                    : selectingCenter
                      ? 'Clique no mapa para escolher o centro.'
                      : 'Escolha um centro no mapa para filtrar.'}
                </FieldDescription>
              </Field>

              <div className="grid grid-cols-3 gap-2">
                <Button variant={selectingCenter ? 'secondary' : 'outline'} onClick={() => setSelectingCenter((value) => !value)}>
                  <MapPin data-icon="inline-start" />
                  Centro
                </Button>
                <Button disabled={!center} onClick={searchRadius}>
                  <Search data-icon="inline-start" />
                  Buscar
                </Button>
                <Button variant="outline" onClick={resetRadius}>
                  <RotateCcw data-icon="inline-start" />
                  Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="pointer-events-auto hidden lg:block">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTipo(tipo === option ? '' : option)}
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLORS[option] }} />
                  <span className="truncate">{option}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
