import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Server, RefreshCw, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react'
import { getNodeStatus } from '../api'

const STATE_CONFIG = {
  PRIMARY:   { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  dot: 'bg-green-500',  icon: CheckCircle },
  SECONDARY: { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-500',   icon: Server },
  ARBITER:   { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-400', icon: Server },
  DOWN:      { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500',    icon: WifiOff },
  UNKNOWN:   { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-600',   dot: 'bg-gray-400',   icon: AlertTriangle },
}

function formatUptime(s) {
  if (!s) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

function NodeCard({ member, delay }) {
  const state  = member.state || (member.health === 0 ? 'DOWN' : 'UNKNOWN')
  const cfg    = STATE_CONFIG[state] || STATE_CONFIG.UNKNOWN
  const Icon   = cfg.icon
  const isPrimary = state === 'PRIMARY'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}
      className={`rounded-2xl border p-6 ${cfg.bg} ${cfg.border} transition-shadow relative overflow-hidden`}
    >
      {isPrimary && (
        <motion.div
          className="absolute inset-0 rounded-2xl"
          animate={{ boxShadow: ['0 0 0 0 rgba(34,197,94,0.3)', '0 0 0 8px rgba(34,197,94,0)', '0 0 0 0 rgba(34,197,94,0.3)'] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className={`w-3 h-3 rounded-full block ${cfg.dot}`} />
            {(state === 'PRIMARY' || state === 'SECONDARY') && (
              <span className={`absolute inset-0 rounded-full ${cfg.dot} animate-ping opacity-50`} />
            )}
          </div>
          <span className={`font-mono text-xs font-semibold ${cfg.text} opacity-70`}>{member.name}</span>
        </div>
        <div className={`p-2 rounded-xl bg-white/60 ${cfg.text}`}>
          <Icon size={16} />
        </div>
      </div>

      <p className={`text-2xl font-bold ${cfg.text} mb-1`}>{state}</p>
      <p className={`text-xs ${cfg.text} opacity-60`}>Uptime: {formatUptime(member.uptime)}</p>

      {state === 'PRIMARY' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 inline-flex items-center gap-1 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Escritas ativas
        </motion.div>
      )}
    </motion.div>
  )
}

const STEPS = [
  { cmd: null,            desc: 'Execute uma consulta no Dashboard e anote o tempo de resposta (estado base)' },
  { cmd: 'docker stop bd2-mongo2',  desc: 'Derrube o nó secundário' },
  { cmd: null,            desc: 'Clique "Atualizar" — mongo2 deve aparecer como DOWN' },
  { cmd: null,            desc: 'Execute as mesmas consultas e verifique que o sistema continua respondendo' },
  { cmd: 'docker start bd2-mongo2', desc: 'Restaure o nó' },
  { cmd: null,            desc: 'Aguarde ~30s, atualize — mongo2 volta como SECONDARY' },
]

export default function NodeStatusPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep]       = useState(null)

  const fetchStatus = () => {
    setLoading(true)
    getNodeStatus()
      .then(r => setData(r.data))
      .catch(() => setData({ ok: false, error: 'Sem conexão com a API', members: [] }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStatus() }, [])

  const placeholders = [
    { name: 'mongo1:27017', state: 'DOWN', health: 0, uptime: 0 },
    { name: 'mongo2:27017', state: 'DOWN', health: 0, uptime: 0 },
    { name: 'mongo3:27017', state: 'DOWN', health: 0, uptime: 0 },
  ]
  const members = data?.members?.length > 0 ? data.members : placeholders

  return (
    <div className="p-4 lg:p-6 max-w-screen-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="text-blue-500" size={24} />
            Status do Cluster MongoDB
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Replica Set rs0 — 3 nós</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={fetchStatus}
          className="flex items-center gap-2 text-sm border border-gray-200 rounded-xl px-4 py-2 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </motion.button>
      </motion.div>

      {/* Node cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {members.map((m, i) => <NodeCard key={m.name} member={m} delay={i * 0.1} />)}
      </div>

      <AnimatePresence>
        {data && !data.ok && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-center gap-3 text-sm text-red-700"
          >
            <AlertTriangle size={16} className="shrink-0" />
            <span><strong>Erro:</strong> {data.error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fault tolerance guide */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
      >
        <h3 className="text-sm font-bold text-gray-700 mb-5 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          Procedimento — Teste de Tolerância a Falhas
        </h3>
        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={i}
              whileHover={{ x: 4 }}
              onClick={() => setStep(step === i ? null : i)}
              className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-colors ${step === i ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                step === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700">{s.desc}</p>
                {s.cmd && (
                  <AnimatePresence>
                    {step === i && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="mt-2"
                      >
                        <code className="bg-gray-900 text-green-400 text-xs px-3 py-1.5 rounded-lg block font-mono">
                          $ {s.cmd}
                        </code>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
