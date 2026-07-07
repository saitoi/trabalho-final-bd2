import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, CheckCircle, AlertCircle, MapPin } from 'lucide-react'
import { createEvent } from '../api'

const TIPOS = [
  'Tiroteio', 'Incêndio', 'Alagamento', 'Chuva intensa', 'Risco hidrológico',
  'Risco geotécnico', 'Problema urbano', 'Transporte', 'Energia',
  'Vazamento de água', 'Interdição de via', 'Outro',
]

const INITIAL = {
  tipo: 'Alagamento', descricao: '',
  dataHora: new Date().toISOString().slice(0, 16),
  gravidade: 3, status: 'Aberto',
  bairro: '', cidade: 'Rio de Janeiro', estado: 'RJ', pais: 'Brasil',
  latitude: '', longitude: '',
}

const GRAV_INFO = ['', 'Muito baixa', 'Baixa', 'Moderada', 'Alta', 'Crítica']
const GRAV_COLORS = ['', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444']

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow'

export default function EventFormPage() {
  const [form, setForm]   = useState(INITIAL)
  const [msg, setMsg]     = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setMsg(null)
    const payload = {
      tipo: form.tipo, descricao: form.descricao,
      dataHora: new Date(form.dataHora).toISOString(),
      gravidade: Number(form.gravidade), status: form.status,
      bairro: form.bairro || null, cidade: form.cidade,
      estado: form.estado, pais: form.pais,
      localizacao: { type: 'Point', coordinates: [Number(form.longitude), Number(form.latitude)] },
      reportante: { tipo: 'Manual', identificador: 'UI' },
      origem: { fonte: 'manual', idOriginal: null, arquivoRaw: null },
      metadados: { extraidoEm: new Date().toISOString() },
    }
    try {
      await createEvent(payload)
      setMsg({ ok: true, text: 'Evento cadastrado com sucesso!' })
      setForm(INITIAL)
    } catch {
      setMsg({ ok: false, text: 'Erro ao cadastrar. Verifique a API.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
          <PlusCircle className="text-blue-500" size={24} />
          Novo Evento
        </h1>
        <p className="text-sm text-gray-500 mb-6">Registre uma nova ocorrência urbana</p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }}
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5"
      >
        {/* Tipo + Gravidade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo de evento" required>
            <select className={inputCls} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Gravidade">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={5} value={form.gravidade}
                  onChange={e => set('gravidade', e.target.value)}
                  className="flex-1"
                  style={{ accentColor: GRAV_COLORS[form.gravidade] }}
                />
                <motion.span
                  key={form.gravidade}
                  initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                  className="text-sm font-bold w-4 text-center"
                  style={{ color: GRAV_COLORS[form.gravidade] }}
                >
                  {form.gravidade}
                </motion.span>
              </div>
              <motion.p
                key={form.gravidade}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs font-medium"
                style={{ color: GRAV_COLORS[form.gravidade] }}
              >
                {GRAV_INFO[form.gravidade]}
              </motion.p>
            </div>
          </Field>
        </div>

        <Field label="Descrição">
          <textarea
            className={`${inputCls} h-20 resize-none`}
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="Descreva a ocorrência..."
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Data e Hora" required>
            <input type="datetime-local" className={inputCls} value={form.dataHora}
              onChange={e => set('dataHora', e.target.value)} required />
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Aberto</option><option>Em atendimento</option><option>Fechado</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Bairro">
            <input className={inputCls} value={form.bairro}
              onChange={e => set('bairro', e.target.value)} placeholder="Ex: Centro" />
          </Field>
          <Field label="Cidade" required>
            <input className={inputCls} value={form.cidade}
              onChange={e => set('cidade', e.target.value)} required />
          </Field>
          <Field label="Estado (UF)" required>
            <input className={inputCls} maxLength={2} value={form.estado}
              onChange={e => set('estado', e.target.value.toUpperCase())} required />
          </Field>
        </div>

        <div className="border rounded-xl p-4 bg-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <MapPin size={12} /> Coordenadas Geográficas
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitude" required>
              <input type="number" step="any" className={inputCls} placeholder="-22.9068"
                value={form.latitude} onChange={e => set('latitude', e.target.value)} required />
            </Field>
            <Field label="Longitude" required>
              <input type="number" step="any" className={inputCls} placeholder="-43.1729"
                value={form.longitude} onChange={e => set('longitude', e.target.value)} required />
            </Field>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Cadastrando...</>
            : <><PlusCircle size={16} /> Cadastrar Evento</>
          }
        </motion.button>

        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
                msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {msg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.form>
    </div>
  )
}
