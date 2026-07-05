import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarRange, Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { getEventsByPeriod } from '../api'

const GRAV_STYLES = [
  '', 'bg-green-100 text-green-700', 'bg-lime-100 text-lime-700',
  'bg-yellow-100 text-yellow-700', 'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700'
]
const PER_PAGE = 20

export default function EventListPage() {
  const [inicio, setInicio]     = useState('2025-01-01')
  const [fim, setFim]           = useState('2025-12-31')
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const [page, setPage]         = useState(0)

  const buscar = () => {
    setLoading(true); setPage(0); setSearched(true)
    getEventsByPeriod(inicio, fim)
      .then(r => setEvents(r.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }

  const totalPages = Math.ceil(events.length / PER_PAGE)
  const paginated  = events.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  return (
    <div className="p-4 lg:p-6 max-w-screen-xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
          <CalendarRange className="text-blue-500" size={24} />
          Consulta por Período
        </h1>
        <p className="text-sm text-gray-500 mb-6">Filtre eventos por intervalo de datas</p>
      </motion.div>

      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6"
      >
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Data início</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              value={inicio} onChange={e => setInicio(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Data fim</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              value={fim} onChange={e => setFim(e.target.value)}
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={buscar}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Search size={14} />
            }
            Buscar
          </motion.button>
          {searched && !loading && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-sm text-gray-500 shrink-0"
            >
              {events.length.toLocaleString('pt-BR')} resultados
            </motion.span>
          )}
        </div>
      </motion.div>

      {/* Table */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </motion.div>
        )}

        {!loading && paginated.length > 0 && (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['ID', 'Tipo', 'Cidade', 'Bairro', 'Grav.', 'Data', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map((ev, i) => (
                      <motion.tr
                        key={ev.idEvento || i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02, duration: 0.2 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-300">{ev.idEvento?.slice(-6)}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{ev.tipo}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{ev.cidade}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{ev.bairro || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${GRAV_STYLES[ev.gravidade] || ''}`}>
                            {ev.gravidade}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{ev.dataHora?.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            ev.status === 'Aberto' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                          }`}>
                            {ev.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Mostrando {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, events.length)} de {events.length.toLocaleString('pt-BR')}
              </p>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-xl text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={14} /> Anterior
                </motion.button>
                <span className="text-sm text-gray-500 px-2">{page + 1} / {totalPages}</span>
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-xl text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Próxima <ChevronRight size={14} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {!loading && searched && events.length === 0 && (
          <motion.div key="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-gray-400"
          >
            <AlertCircle size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum evento encontrado nesse período.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
