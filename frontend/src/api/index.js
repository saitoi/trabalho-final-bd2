import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getEvents = (params) =>
  api.get('/events', { params })

export const searchEvents = (params) =>
  api.get('/events/search', { params })

export const getEventFilterOptions = (params) =>
  api.get('/events/filter-options', { params })

export const createEvent = (data) =>
  api.post('/events', data)

export const getEventsByPeriod = (inicio, fim) =>
  api.get('/events/by-period', { params: { inicio, fim } })

export const getEventsByLocation = (lat, lon, km, limit) =>
  api.get('/events/by-location', { params: { lat, lon, km, limit } })

export const getEventsBySeverity = (min) =>
  api.get('/events/by-severity', { params: { min } })

export const getStatsByType = () =>
  api.get('/stats/by-type')

export const getStatsSummary = () =>
  api.get('/stats/summary')

export const getStatsByNeighborhood = () =>
  api.get('/stats/by-neighborhood')

export const getStatsBySeverity = () =>
  api.get('/stats/by-severity')

export const getStatsByReporter = () =>
  api.get('/stats/by-reporter')

export const getStatsTemporal = () =>
  api.get('/stats/temporal')

export const getNodeStatus = () =>
  api.get('/nodes/status')

export const getBenchmarkResults = () =>
  api.get('/benchmarks/results')
