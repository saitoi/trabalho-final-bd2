import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getEvents = (params) =>
  api.get('/events/', { params })

export const searchEvents = (params) =>
  api.get('/events/search', { params })

export const getEventFilterOptions = (params) =>
  api.get('/events/filter-options', { params })

export const createEvent = (data) =>
  api.post('/events/', data)

export const getEventsByPeriod = (inicio, fim) =>
  api.get('/events/by-period', { params: { inicio, fim } })

export const getEventsByLocation = (lat, lon, km, limit) =>
  api.get('/events/by-location', { params: { lat, lon, km, limit } })

export const getEventsBySeverity = (min) =>
  api.get('/events/by-severity', { params: { min } })

export const getStatsByType = (params) =>
  api.get('/stats/by-type', { params })

export const getStatsSummary = (params) =>
  api.get('/stats/summary', { params })

export const getStatsByNeighborhood = (params) =>
  api.get('/stats/by-neighborhood', { params })

export const getStatsByNeighborhoodType = (params) =>
  api.get('/stats/by-neighborhood-type', { params })

export const getStatsByWeekday = (params) =>
  api.get('/stats/by-weekday', { params })

export const getStatsBySeverity = (params) =>
  api.get('/stats/by-severity', { params })

export const getStatsByReporter = (params) =>
  api.get('/stats/by-reporter', { params })

export const getStatsTemporal = (params) =>
  api.get('/stats/temporal', { params })

export const getStatsTemporalByType = (params) =>
  api.get('/stats/temporal-by-type', { params })

export const getNodeStatus = () =>
  api.get('/nodes/status')

export const stopNode = (name) =>
  api.post(`/nodes/${name}/stop`)

export const startNode = (name) =>
  api.post(`/nodes/${name}/start`)

export const getBenchmarkResults = () =>
  api.get('/benchmarks/results')
