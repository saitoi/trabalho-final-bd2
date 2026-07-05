import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getEvents = (params) =>
  api.get('/events', { params })

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

export const getStatsByNeighborhood = () =>
  api.get('/stats/by-neighborhood')

export const getStatsTemporal = () =>
  api.get('/stats/temporal')

export const getNodeStatus = () =>
  api.get('/nodes/status')
