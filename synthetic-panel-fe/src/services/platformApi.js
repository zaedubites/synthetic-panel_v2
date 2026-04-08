import axios from 'axios'

const PLATFORM_URL = import.meta.env.VITE_PLATFORM_API_URL || 'http://localhost:8001'

const platformApi = axios.create({
  baseURL: `${PLATFORM_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// Reuse the same auth token and send organization context
// Super admins have no organization_id in their token, so we pass
// the selected org via X-OrganizationId header (same pattern as platform-fe)
platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('synthetic_panel_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const orgData = localStorage.getItem('synthetic_panel_org')
  if (orgData) {
    try {
      const org = JSON.parse(orgData)
      // x-organization-subdomain — used by get_current_organization dependency
      if (org.subdomain) {
        config.headers['x-organization-subdomain'] = org.subdomain
      }
      // X-OrganizationId — used by get_organization_filter for super admins
      if (org.id) {
        config.headers['X-OrganizationId'] = org.id
      }
    } catch (e) {
      // ignore
    }
  }

  return config
})

// Auto-refresh on 401 — reuse the same refresh logic
let _platformRefreshing = false
let _platformQueue = []

platformApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('synthetic_panel_refresh_token')
      if (!refreshToken) {
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (_platformRefreshing) {
        return new Promise((resolve, reject) => {
          _platformQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return platformApi(originalRequest)
        })
      }

      originalRequest._retry = true
      _platformRefreshing = true

      try {
        const { authService } = await import('./authApi')
        const res = await authService.refresh(refreshToken)
        const { access_token, refresh_token: newRefresh } = res.data

        localStorage.setItem('synthetic_panel_token', access_token)
        if (newRefresh) localStorage.setItem('synthetic_panel_refresh_token', newRefresh)

        _platformQueue.forEach(({ resolve }) => resolve(access_token))
        _platformQueue = []

        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return platformApi(originalRequest)
      } catch (refreshError) {
        _platformQueue.forEach(({ reject }) => reject(refreshError))
        _platformQueue = []
        localStorage.removeItem('synthetic_panel_token')
        localStorage.removeItem('synthetic_panel_refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        _platformRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export const knowledgeGroupsApi = {
  list: (params = {}) => platformApi.get('/knowledge-groups', { params }),
  get: (id) => platformApi.get(`/knowledge-groups/${id}`),
}

export const knowledgeSourcesApi = {
  list: (params = {}) => platformApi.get('/knowledge', { params }),
  get: (id) => platformApi.get(`/knowledge/${id}`),
}

export default platformApi
