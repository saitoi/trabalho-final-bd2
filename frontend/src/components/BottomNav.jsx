import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Map, LayoutDashboard, PlusCircle, Server } from 'lucide-react'

const NAV = [
  { to: '/',          icon: Home,            label: 'Início',    end: true  },
  { to: '/map',       icon: Map,             label: 'Mapa',      end: false },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: false },
  { to: '/new-event', icon: PlusCircle,      label: 'Novo',      end: false },
  { to: '/nodes',     icon: Server,          label: 'Nós',       end: false },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-gray-900 border-t border-gray-800 flex safe-bottom">
      {NAV.map(({ to, icon: Icon, label, end }) => {
        const active = end ? location.pathname === to : location.pathname.startsWith(to)
        return (
          <NavLink key={to} to={to} className="flex-1">
            <motion.div
              whileTap={{ scale: 0.88 }}
              className={`flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                active ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="bottomActiveBar"
                  className="absolute top-0 h-0.5 w-8 bg-blue-400 rounded-full"
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                />
              )}
              <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </motion.div>
          </NavLink>
        )
      })}
    </nav>
  )
}
