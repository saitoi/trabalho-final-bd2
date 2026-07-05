import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getEvents = (params) =>
  api.get('/events', { params })

export const searchEvents = (params) =>
  api.get('/events/search', { params })

export const createEvent = (data) =>
  api.post('/events', data)

export const getEventsByPeriod = (inicio, fim) =>
  api.get('/events/by-period', { params: { inicio, fim } })

export const getEventsByLocation = (lat, lon, km) =>
  api.get('/events/by-location', { params: { lat, lon, km } })

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

export const getStatsByCountry = () =>
  api.get('/stats/by-country')

export const getStatsByState = () =>
  api.get('/stats/by-state')

export const getStatsByCity = () =>
  api.get('/stats/by-city')

export const getStatsByReporter = () =>
  api.get('/stats/by-reporter')

export const getStatsTemporal = () =>
  api.get('/stats/temporal')

export const getNodeStatus = () =>
  api.get('/nodes/status')

export const getBenchmarkResults = () =>
  api.get('/benchmarks/results')
