import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Map, BarChart2, CalendarRange, Server,
  Database, Activity, Globe, GitBranch,
  GraduationCap, BookOpen,
} from 'lucide-react'

const FEATURES = [
  { icon: Map,          color: 'blue',   title: 'Mapa Interativo',        desc: 'Visualização geoespacial de eventos com filtro por tipo e busca por raio.' },
  { icon: BarChart2,    color: 'purple', title: 'Dashboard Analítico',     desc: 'Gráficos de distribuição por tipo, bairro e evolução temporal com zoom.' },
  { icon: Database,     color: 'orange', title: 'Replica Set MongoDB',     desc: 'Três nós replicados com eleição automática de PRIMARY e tolerância a falhas.' },
  { icon: Globe,        color: 'green',  title: 'Múltiplas Fontes',        desc: 'Dados de Fogo Cruzado, INPE BDQueimadas, INMET, OSM, NYC 311 e outros.' },
  { icon: Activity,     color: 'red',    title: 'Pipeline Automatizado',   desc: 'Extração → normalização → benchmark (1 K / 50 K / 100 K) em scripts idempotentes.' },
  { icon: GitBranch,    color: 'indigo', title: 'Experimentos de Desempenho', desc: 'Benchmark de consultas com e sem índices, e teste de falha de nó em tempo real.' },
]

const STACK = [
  { label: 'Python 3.8+', bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { label: 'FastAPI',      bg: 'bg-teal-50  text-teal-700  border-teal-200'  },
  { label: 'MongoDB',      bg: 'bg-green-50 text-green-700 border-green-200' },
  { label: 'React 18',     bg: 'bg-blue-50  text-blue-700  border-blue-200'  },
  { label: 'Docker',       bg: 'bg-sky-50   text-sky-700   border-sky-200'   },
  { label: 'Leaflet',      bg: 'bg-lime-50  text-lime-700  border-lime-200'  },
  { label: 'Recharts',     bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  { label: 'Tailwind CSS', bg: 'bg-cyan-50  text-cyan-700  border-cyan-200'  },
]

const MEMBERS = [
  { name: 'Milton Salgado',    dre: '122169279' },
  { name: 'Pedro Saito',       dre: '122149392' },
  { name: 'Eduardo Bensabat',  dre: '122149392' },
  { name: 'Gabriel Guimarães', dre: '122137997' },
]

const COLOR = {
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   border: 'border-blue-100'   },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-500', border: 'border-purple-100' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-500', border: 'border-orange-100' },
  green:  { bg: 'bg-green-50',  icon: 'text-green-500',  border: 'border-green-100'  },
  red:    { bg: 'bg-red-50',    icon: 'text-red-500',    border: 'border-red-100'    },
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-500', border: 'border-indigo-100' },
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.45, ease: 'easeOut' },
})

export default function HomePage() {
  return (
    <div className="min-h-full bg-gray-50 overflow-y-auto pb-8">

      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white px-6 py-14 lg:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div {...fadeUp(0)} className="flex justify-center mb-5">
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium">
              <GraduationCap size={15} />
              UFRJ · Bancos de Dados II · 2026/1
            </span>
          </motion.div>
          <motion.h1 {...fadeUp(0.08)} className="text-3xl lg:text-5xl font-extrabold leading-tight mb-4">
            Sistema Distribuído de Monitoramento de Eventos Urbanos
          </motion.h1>
          <motion.p {...fadeUp(0.16)} className="text-blue-200 text-base lg:text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            Coleta, normaliza e analisa ocorrências urbanas brasileiras — tiroteios, incêndios,
            alagamentos e mais — sobre um Replica Set MongoDB com três nós, permitindo experimentos
            de desempenho e tolerância a falhas em ambiente distribuído real.
          </motion.p>
          <motion.div {...fadeUp(0.22)} className="flex flex-wrap justify-center gap-3">
            <Link
              to="/map"
              className="inline-flex items-center gap-2 bg-white text-blue-800 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-blue-50 transition-colors"
            >
              <Map size={16} /> Ver Mapa
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-medium px-5 py-2.5 rounded-xl text-sm hover:bg-white/20 transition-colors"
            >
              <BarChart2 size={16} /> Dashboard
            </Link>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 lg:px-6">

        {/* Funcionalidades */}
        <motion.div {...fadeUp(0.1)} className="mt-12">
          <h2 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
            <BookOpen size={18} className="text-blue-500" /> Funcionalidades
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, color, title, desc }, i) => {
              const c = COLOR[color]
              return (
                <motion.div
                  key={title}
                  {...fadeUp(0.1 + i * 0.06)}
                  whileHover={{ y: -3, boxShadow: '0 10px 28px rgba(0,0,0,0.08)' }}
                  className={`rounded-2xl border p-5 ${c.bg} ${c.border} transition-shadow`}
                >
                  <div className={`mb-3 ${c.icon}`}><Icon size={22} /></div>
                  <p className="font-semibold text-gray-800 text-sm mb-1">{title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Stack */}
        <motion.div {...fadeUp(0.2)} className="mt-12">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Tecnologias</h2>
          <div className="flex flex-wrap gap-2">
            {STACK.map(({ label, bg }) => (
              <span key={label} className={`border rounded-full px-3.5 py-1.5 text-xs font-semibold ${bg}`}>
                {label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Integrantes */}
        <motion.div {...fadeUp(0.25)} className="mt-12">
          <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
            <GraduationCap size={18} className="text-blue-500" /> Integrantes
          </h2>
          <p className="text-sm text-gray-400 mb-5">Turma de Bancos de Dados II — UFRJ 2026/1</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MEMBERS.map(({ name, dre }, i) => (
              <motion.div
                key={dre + i}
                {...fadeUp(0.28 + i * 0.06)}
                className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-gray-800">{name}</p>
                <p className="text-xs text-gray-400 mt-0.5">DRE: {dre}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Navegação rápida */}
        <motion.div {...fadeUp(0.35)} className="mt-12">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Navegar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { to: '/map',       icon: Map,           label: 'Mapa',      color: 'text-blue-600'   },
              { to: '/dashboard', icon: BarChart2,      label: 'Dashboard', color: 'text-purple-600' },
              { to: '/events',    icon: CalendarRange,  label: 'Período',   color: 'text-orange-600' },
              { to: '/nodes',     icon: Server,         label: 'Nós',       color: 'text-green-600'  },
            ].map(({ to, icon: Icon, label, color }, i) => (
              <motion.div key={to} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to={to}
                  className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl py-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <Icon size={22} className={color} />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
