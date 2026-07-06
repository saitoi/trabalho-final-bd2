import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import HomePage from './pages/HomePage'
import MapPage from './pages/MapPage'
import DashboardPage from './pages/DashboardPage'
import EventListPage from './pages/EventListPage'
import NodeStatusPage from './pages/NodeStatusPage'
import BenchmarkPage from './pages/BenchmarkPage'

export default function App() {
  return (
    <TooltipProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/events" element={<EventListPage />} />
          <Route path="/benchmark" element={<BenchmarkPage />} />
          <Route path="/nodes" element={<NodeStatusPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
      <Toaster position="top-right" richColors closeButton />
    </TooltipProvider>
  )
}
