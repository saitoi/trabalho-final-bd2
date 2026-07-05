import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Brush, Cell, Legend
} from 'recharts'
import { TrendingUp, Map, AlertTriangle, BarChart2, RefreshCw } from 'lucide-react'
import { getStatsByType, getStatsByNeighborhood, getStatsTemporal, getEvents } from '../api'

const TIPO_CORES = {
  'Tiroteio': '#ef4444', 'Incêndio': '#f97316', 'Alagamento': '#3b82f6',
  'Chuva intensa': '#6366f1', 'Risco hidrológico': '#8b5cf6',
  'Risco geotécnico': '#a855f7', 'Problema urbano': '#6b7280',
  'Transporte': '#f59e0b', 'Energia': '#eab308', 'Vazamento de água': '#06b6d4',
  'Interdição de via': '#84cc16', 'Outro': '#9ca3af',
}

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    if (!target) return
    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(ease * target))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return value
}

function StatCard({ label, value, icon: Icon, color, delay = 0 }) {
  const animated = useCountUp(value)
  const colors = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', icon: 'text-blue-400' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', icon: 'text-orange-400' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-700', icon: 'text-purple-400' },
    green: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', icon: 'text-green-400' },
  }
  const c = colors[color]
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
      className={`rounded-2xl border p-5 ${c.bg} ${c.border} transition-shadow`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className={`text-sm font-medium ${c.text} opacity-80`}>{label}</p>
        <div className={`p-2 rounded-lg bg-white/60 ${c.icon}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-4xl font-bold ${c.text}`}>{animated.toLocaleString('pt-BR')}</p>
    </motion.div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border border-gray-100 rounded-xl shadow-xl p-3 min-w-32"
    >
      <p className="text-xs text-gray-500 mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.fill || p.color || '#3b82f6' }}>
          {p.value.toLocaleString('pt-BR')} eventos
        </p>
      ))}
    </motion.div>
  )
}

function ChartCard({ title, children, delay = 0, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {action}
      </div>
      {children}
    </motion.div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="h-80 bg-gray-100 rounded-2xl" />
        <div className="h-80 bg-gray-100 rounded-2xl" />
      </div>
      <div className="h-64 bg-gray-100 rounded-2xl" />
    </div>
  )
}

export default function DashboardPage() {
  const [byType, setByType]           = useState([])
  const [byNeighborhood, setByN]      = useState([])
  const [temporal, setTemporal]       = useState([])
  const [selectedType, setSelected]   = useState(null)
  const [typeEvents, setTypeEvents]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)

  const load = async () => {
    try {
      const [t, n, tmp] = await Promise.all([
        getStatsByType(), getStatsByNeighborhood(), getStatsTemporal()
      ])
      setByType(t.data.map(d => ({ name: d._id || 'N/D', total: d.total, fill: TIPO_CORES[d._id] || '#9ca3af' })))
      setByN(n.data.map(d => ({ name: d._id || 'N/D', total: d.total })))
      setTemporal(tmp.data.map(d => ({ data: d._id, total: d.total })))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleTypeClick = async (data) => {
    if (!data?.activePayload?.[0]) return
    const tipo = data.activePayload[0].payload.name
    if (selectedType === tipo) { setSelected(null); setTypeEvents([]); return }
    setSelected(tipo)
    const r = await getEvents({ tipo, limit: 5 })
    setTypeEvents(r.data)
  }

  const refresh = () => { setRefreshing(true); load() }

  const total = byType.reduce((s, d) => s + d.total, 0)
  const maxGravidade = byType.find(d => d.name === 'Tiroteio')?.total || 0

  if (loading) return <div className="p-6"><Skeleton /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análise de eventos urbanos em tempo real</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={refresh}
          className="flex items-center gap-2 text-sm border border-gray-200 rounded-xl px-4 py-2 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </motion.button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="Total de Eventos" value={total}           icon={BarChart2}    color="blue"   delay={0}    />
        <StatCard label="Tipos Registrados" value={byType.length} icon={AlertTriangle} color="orange" delay={0.05} />
        <StatCard label="Bairros Afetados"  value={byNeighborhood.length} icon={Map}  color="purple" delay={0.1}  />
        <StatCard label="Maior Categoria"   value={maxGravidade}  icon={TrendingUp}    color="green"  delay={0.15} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Eventos por Tipo"
          delay={0.2}
          action={selectedType && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{ background: TIPO_CORES[selectedType] + '22', color: TIPO_CORES[selectedType] }}
            >
              {selectedType}
            </motion.span>
          )}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={byType}
              layout="vertical"
              margin={{ left: 100, right: 24 }}
              onClick={handleTypeClick}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} width={95} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={800}>
                {byType.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.fill}
                    opacity={selectedType && selectedType !== d.name ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {selectedType && typeEvents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 border-t pt-4"
            >
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Exemplos de {selectedType}</p>
              <div className="space-y-1.5">
                {typeEvents.slice(0, 3).map((ev, i) => (
                  <div key={i} className="text-xs bg-gray-50 rounded-lg px-3 py-2 flex justify-between">
                    <span className="text-gray-700 truncate flex-1">{ev.bairro || ev.cidade} — {ev.descricao?.slice(0, 50)}</span>
                    <span className="text-gray-400 ml-2 shrink-0">{ev.dataHora?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </ChartCard>

        <ChartCard title="Top 10 Bairros" delay={0.25}>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={byNeighborhood.slice(0, 10)}
              layout="vertical"
              margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
              barSize={22}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                axisLine={false}
                tickLine={false}
                tick={({ x, y, payload }) => {
                  const full = payload.value
                  const label = full.length > 18 ? full.slice(0, 17) + '…' : full
                  return (
                    <text x={x} y={y} dy={5} textAnchor="end" fill="#374151" fontSize={11} fontFamily="inherit">
                      {label}
                    </text>
                  )
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" fill="#8b5cf6" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Temporal chart */}
      <ChartCard
        title="Evolução Temporal — eventos por dia"
        delay={0.3}
        action={<span className="text-xs text-gray-400">Arraste para zoom</span>}
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={temporal} margin={{ left: 0, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone" dataKey="total" stroke="#f97316"
              strokeWidth={2} dot={false}
              activeDot={{ r: 5, fill: '#f97316', strokeWidth: 0 }}
              isAnimationActive animationDuration={1200}
            />
            <Brush dataKey="data" height={20} stroke="#e5e7eb" fill="#f9fafb" travellerWidth={6} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
