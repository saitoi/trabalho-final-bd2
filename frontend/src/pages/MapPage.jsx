import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, MapPin, X, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { getEvents, getEventsByLocation } from '../api'

const TIPO_CORES = {
  'Tiroteio':          '#ef4444',
  'Incêndio':          '#f97316',
  'Alagamento':        '#3b82f6',
  'Chuva intensa':     '#6366f1',
  'Risco hidrológico': '#8b5cf6',
  'Risco geotécnico':  '#a855f7',
  'Problema urbano':   '#6b7280',
  'Transporte':        '#f59e0b',
  'Energia':           '#eab308',
  'Vazamento de água': '#06b6d4',
  'Interdição de via': '#84cc16',
  'Outro':             '#9ca3af',
}
const TIPOS = Object.keys(TIPO_CORES)

function ClickHandler({ ativo, onSelect }) {
  useMapEvents({ click(e) { if (ativo) onSelect([e.latlng.lat, e.latlng.lng]) } })
  return null
}

export default function MapPage() {
  const [events, setEvents]       = useState([])
  const [filtroTipo, setFiltro]   = useState('')
  const [raioKm, setRaio]         = useState(5)
  const [centro, setCentro]       = useState(null)
  const [modoRaio, setModoRaio]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)

  const loadEvents = (tipo, limit = 500) => {
    setLoading(true)
    getEvents({ tipo: tipo || undefined, limit })
      .then(r => setEvents(r.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadEvents(filtroTipo) }, [filtroTipo])

  const buscarRaio = () => {
    if (!centro) return
    setLoading(true)
    getEventsByLocation(centro[0], centro[1], raioKm)
      .then(r => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const limpar = () => { setCentro(null); setModoRaio(false); loadEvents(filtroTipo) }

  return (
    <div className="flex flex-col lg:flex-row h-full relative">

      {/* Mobile toggle */}
      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setPanelOpen(o => !o)}
        className="lg:hidden absolute top-3 left-3 z-[1000] bg-white shadow-lg rounded-xl px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-700"
      >
        <Filter size={14} />
        Filtros
        {panelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {(panelOpen) && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="w-full lg:w-72 bg-white shadow-md flex flex-col gap-4 overflow-auto z-10 shrink-0 p-4 max-h-64 lg:max-h-full"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Filter size={16} className="text-blue-500" /> Filtros
              </h2>
              <motion.span
                animate={{ opacity: loading ? 1 : 0 }}
                className="text-xs text-blue-500 font-medium"
              >
                Carregando...
              </motion.span>
            </div>

            {/* Tipo filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Tipo de evento</label>
              <div className="flex flex-wrap gap-1.5">
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setFiltro('')}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    !filtroTipo ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  Todos
                </motion.button>
                {TIPOS.map(t => (
                  <motion.button
                    key={t}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setFiltro(t)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                      filtroTipo === t ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                    style={filtroTipo === t ? { background: TIPO_CORES[t], borderColor: TIPO_CORES[t] } : {}}
                  >
                    {t}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Raio */}
            <div className="border-t pt-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Busca por raio</label>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setModoRaio(m => !m)}
                className={`w-full text-sm rounded-xl py-2 px-3 mb-2 font-medium flex items-center gap-2 justify-center transition-colors ${
                  modoRaio ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <MapPin size={14} />
                {modoRaio ? 'Clique no mapa...' : 'Selecionar ponto'}
              </motion.button>

              <AnimatePresence>
                {centro && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-gray-400 font-mono mb-2"
                  >
                    {centro[0].toFixed(4)}, {centro[1].toFixed(4)}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-gray-500 shrink-0">Raio (km)</label>
                <input
                  type="range" min={1} max={100} value={raioKm}
                  onChange={e => setRaio(Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                />
                <span className="text-xs font-bold text-blue-600 w-8 text-right">{raioKm}</span>
              </div>

              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  disabled={!centro}
                  onClick={buscarRaio}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl py-2 disabled:opacity-40 flex items-center justify-center gap-1.5 font-medium transition-colors"
                >
                  <Search size={14} /> Buscar
                </motion.button>
                {centro && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={limpar}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
                  >
                    <X size={16} />
                  </motion.button>
                )}
              </div>
            </div>

            {/* Count */}
            <motion.div
              key={events.length}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-gray-400 border-t pt-3"
            >
              <span className="font-bold text-gray-700 text-sm">{events.length.toLocaleString('pt-BR')}</span> eventos exibidos
            </motion.div>

            {/* Legenda */}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Legenda</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {TIPOS.map(t => (
                  <button
                    key={t}
                    onClick={() => setFiltro(filtroTipo === t ? '' : t)}
                    className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 text-left transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TIPO_CORES[t] }} />
                    <span className="truncate">{t}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <MapContainer center={[-22.9068, -43.1729]} zoom={11} className="h-full w-full">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />
          <ClickHandler ativo={modoRaio} onSelect={pos => { setCentro(pos); setModoRaio(false) }} />
          {events.map((ev, i) => {
            const coords = ev.localizacao?.coordinates
            if (!coords) return null
            const cor = TIPO_CORES[ev.tipo] || '#9ca3af'
            return (
              <CircleMarker
                key={ev.idEvento || i}
                center={[coords[1], coords[0]]}
                radius={5}
                pathOptions={{ color: cor, fillColor: cor, fillOpacity: 0.75, weight: 1 }}
              >
                <Popup className="rounded-xl">
                  <div className="text-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: cor }} />
                      <strong>{ev.tipo}</strong>
                    </div>
                    {ev.descricao && <p className="text-xs text-gray-500 mb-1">{ev.descricao}</p>}
                    <p className="text-xs text-gray-400">{ev.bairro ? `${ev.bairro} · ` : ''}{ev.cidade}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs font-semibold" style={{ color: cor }}>Gravidade {ev.gravidade}</span>
                      <span className="text-xs text-gray-400">{ev.dataHora?.slice(0, 10)}</span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
