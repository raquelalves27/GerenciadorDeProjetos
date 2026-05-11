import axios from 'axios'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({ baseURL: BASE, headers: { 'Content-Type': 'application/json' }, timeout: 15000 })

api.interceptors.request.use(cfg => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) cfg.headers.Authorization = `Bearer ${token}`
  }
  return cfg
})

let refreshing = false
let queue: any[] = []
const flush = (err: any, token: any) => { queue.forEach(p => err ? p.reject(err) : p.resolve(token)); queue = [] }

api.interceptors.response.use(r => r, async (error) => {
  const orig = error.config
  if (error.response?.status === 401 && !orig._retry) {
    if (refreshing) return new Promise((res, rej) => queue.push({ resolve: res, reject: rej })).then(t => { orig.headers.Authorization = `Bearer ${t}`; return api(orig) })
    orig._retry = true; refreshing = true
    const rt = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null
    if (!rt) { if (typeof window !== 'undefined') { localStorage.clear(); window.location.href = '/login' }; return Promise.reject(error) }
    try {
      const { data } = await axios.post(`${BASE}/api/v1/auth/refresh`, { refresh_token: rt })
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      flush(null, data.access_token)
      orig.headers.Authorization = `Bearer ${data.access_token}`
      return api(orig)
    } catch (e) { flush(e, null); localStorage.clear(); if (typeof window !== 'undefined') window.location.href = '/login'; return Promise.reject(e) }
    finally { refreshing = false }
  }
  return Promise.reject(error)
})

const r = (url: string) => api.get(url).then(x => x.data)
const post = (url: string, data: any) => api.post(url, data).then(x => x.data)
const patch = (url: string, data: any) => api.patch(url, data).then(x => x.data)
const del = (url: string) => api.delete(url)

export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams(); form.append('username', email); form.append('password', password)
    return api.post('/api/v1/auth/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then(x => x.data)
  },
  me: () => r('/api/v1/auth/me'),
}

export const clientsApi = {
  list: () => r('/api/v1/clients/'),
  create: (d: any) => post('/api/v1/clients/', d),
  update: (id: string, d: any) => patch(`/api/v1/clients/${id}`, d),
  delete: (id: string) => del(`/api/v1/clients/${id}`),
}

export const productsApi = {
  list: () => r('/api/v1/products/'),
  create: (d: any) => post('/api/v1/products/', d),
  delete: (id: string) => del(`/api/v1/products/${id}`),
}

export const usersApi = {
  list: () => r('/api/v1/users/'),
  create: (d: any) => post('/api/v1/users/', d),
  update: (id: string, d: any) => patch(`/api/v1/users/${id}`, d),
  delete: (id: string) => del(`/api/v1/users/${id}`),
}

export const projectsApi = {
  list: (params?: any) => api.get('/api/v1/projects/', { params }).then(x => x.data),
  get: (id: string) => r(`/api/v1/projects/${id}`),
  create: (d: any) => post('/api/v1/projects/', d),
  update: (id: string, d: any) => patch(`/api/v1/projects/${id}`, d),
  delete: (id: string) => del(`/api/v1/projects/${id}`),
  addUpdate: (id: string, d: any) => post(`/api/v1/projects/${id}/updates`, d),
  getUpdates: (id: string) => r(`/api/v1/projects/${id}/updates`),
  addStage: (id: string, d: any) => post(`/api/v1/projects/${id}/stages`, d),
  getStages: (id: string) => r(`/api/v1/projects/${id}/stages`),
  addRisk: (id: string, d: any) => post(`/api/v1/projects/${id}/risks`, d),
  getRisks: (id: string) => r(`/api/v1/projects/${id}/risks`),
}

export const scheduleApi = {
  getWeek: (weekStart: string) => r(`/api/v1/schedule/week?week_start=${weekStart}`),
  create: (d: any) => post('/api/v1/schedule/', d),
  update: (id: string, d: any) => patch(`/api/v1/schedule/${id}`, d),
  delete: (id: string) => del(`/api/v1/schedule/${id}`),
  cloneWeek: (d: any) => post('/api/v1/schedule/clone-week', d),
}

export const kpisApi = {
  executive: () => r('/api/v1/kpis/executive'),
  teamCapacity: (weekStart: string) => r(`/api/v1/kpis/team-capacity?week_start=${weekStart}`),
}
