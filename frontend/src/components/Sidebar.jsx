import { NavLink } from 'react-router-dom'
import { Home, Map, LayoutDashboard, CalendarRange, PlusCircle, Server, Activity } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'

const NAV = [
  { to: '/',          icon: Home,            label: 'Início'               },
  { to: '/map',       icon: Map,             label: 'Mapa de Eventos'      },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'            },
  { to: '/events',    icon: CalendarRange,   label: 'Consulta por Período' },
  { to: '/new-event', icon: PlusCircle,      label: 'Novo Evento'          },
  { to: '/nodes',     icon: Server,          label: 'Status dos Nós'       },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 224 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden lg:flex bg-gray-900 text-gray-300 flex-col shrink-0 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between min-w-0">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.1 }}
            className="min-w-0"
          >
            <h1 className="text-sm font-bold text-white leading-tight truncate">Eventos Urbanos</h1>
            <p className="text-xs text-gray-500 mt-0.5 truncate">UFRJ · BD II · 2026-1</p>
          </motion.div>
        )}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCollapsed(c => !c)}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded shrink-0"
        >
          <Activity size={16} />
        </motion.button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {NAV.map(({ to, icon: Icon, label }, i) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                whileHover={{ x: 3 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 bg-blue-600 rounded-lg"
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    style={{ zIndex: -1 }}
                  />
                )}
                <Icon size={18} className="shrink-0" />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="truncate font-medium"
                  >
                    {label}
                  </motion.span>
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 border-t border-gray-700"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-500 truncate">MongoDB · 3 nós</span>
          </div>
        </motion.div>
      )}
    </motion.aside>
  )
}
