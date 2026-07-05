import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import MapPage from './pages/MapPage'
import DashboardPage from './pages/DashboardPage'
import EventListPage from './pages/EventListPage'
import EventFormPage from './pages/EventFormPage'
import NodeStatusPage from './pages/NodeStatusPage'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

function PageWrapper({ children }) {
  return (
    <motion.div
      className="h-full"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/"          element={<PageWrapper><HomePage /></PageWrapper>} />
            <Route path="/map"       element={<PageWrapper><MapPage /></PageWrapper>} />
            <Route path="/dashboard" element={<PageWrapper><DashboardPage /></PageWrapper>} />
            <Route path="/events"    element={<PageWrapper><EventListPage /></PageWrapper>} />
            <Route path="/new-event" element={<PageWrapper><EventFormPage /></PageWrapper>} />
            <Route path="/nodes"     element={<PageWrapper><NodeStatusPage /></PageWrapper>} />
          </Routes>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
