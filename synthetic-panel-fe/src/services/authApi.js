import axios from 'axios'

const AUTH_URL = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:8001'

const authApi = axios.create({
  baseURL: `${AUTH_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

export const authService = {
  login: (email, password, subdomain) =>
    authApi.post('/auth/login', { email, password, ...(subdomain && { subdomain }) }),

  refresh: (refreshToken) =>
    authApi.post('/auth/refresh', { refresh_token: refreshToken }),

  me: (token) =>
    authApi.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),

  organizations: (token) =>
    authApi.get('/organizations', { headers: { Authorization: `Bearer ${token}` } }),

  getOrgBySubdomain: (subdomain) =>
    authApi.get(`/public/organizations/${subdomain}`),
}

export default authService
