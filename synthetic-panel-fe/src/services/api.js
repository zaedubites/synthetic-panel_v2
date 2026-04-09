import axios from 'axios'

// API base URL from environment or default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8003'

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('synthetic_panel_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Add organization ID header if available
    const orgData = localStorage.getItem('synthetic_panel_org')
    if (orgData) {
      try {
        const org = JSON.parse(orgData)
        if (org.id) {
          config.headers['X-Organization-Id'] = org.id
        }
        if (org.subdomain) {
          config.headers['X-Organization-Subdomain'] = org.subdomain
        }
      } catch (e) {
        console.error('Failed to parse organization data')
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Track if we're already refreshing to avoid infinite loops
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  failedQueue = []
}

// Response interceptor — auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      // In iframe mode, request new token from parent
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'REQUEST_TOKEN' }, '*')
        return Promise.reject(error)
      }

      // Standalone mode — try refresh token
      const refreshToken = localStorage.getItem('synthetic_panel_refresh_token')
      if (!refreshToken) {
        // No refresh token — force logout
        localStorage.removeItem('synthetic_panel_token')
        localStorage.removeItem('synthetic_panel_refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Another request is already refreshing — queue this one
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { authService } = await import('./authApi')
        const res = await authService.refresh(refreshToken)
        const { access_token, refresh_token: newRefreshToken } = res.data

        localStorage.setItem('synthetic_panel_token', access_token)
        if (newRefreshToken) {
          localStorage.setItem('synthetic_panel_refresh_token', newRefreshToken)
        }

        api.defaults.headers.common.Authorization = `Bearer ${access_token}`
        processQueue(null, access_token)

        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('synthetic_panel_token')
        localStorage.removeItem('synthetic_panel_refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// ============================================
// Personas API
// ============================================

export const personasApi = {
  list: (params = {}) => api.get('/personas', { params }),
  get: (id) => api.get(`/personas/${id}`),
  create: (data) => api.post('/personas', data),
  update: (id, data) => api.put(`/personas/${id}`, data),
  delete: (id) => api.delete(`/personas/${id}`),
  generateProfile: (id) => api.post(`/personas/${id}/generate-profile`),
  generateBackstory: (id, data) => api.post(`/personas/${id}/generate-backstory`, data),
  generateAvatar: (id, data) => api.post(`/personas/${id}/generate-avatar`, data),
  chat: (id, data) => api.post(`/personas/${id}/chat`, data),
  batchGenerate: (data) => api.post('/personas/batch-generate', data),
  batchGenerateStatus: (taskId) => api.get(`/personas/batch-generate/${taskId}/status`),

  // Preview personas (AI-generated previews)
  previewPersonas: (data) => api.post('/personas/preview', data),
  previewPersonasStatus: (taskId) => api.get(`/personas/preview/${taskId}/status`),

  // Helper: dispatch preview task and poll until complete
  previewPersonasAndWait: async (data, onProgress) => {
    const res = await api.post('/personas/preview', data)
    const taskId = res.data.task_id
    if (onProgress) onProgress('processing', taskId)

    while (true) {
      await new Promise(r => setTimeout(r, 3000))
      const status = await api.get(`/personas/preview/${taskId}/status`)
      const s = status.data

      if (s.status === 'completed') return s.result
      if (s.status === 'failed') throw new Error(s.error || 'Preview generation failed')
      if (onProgress) onProgress(s.status, taskId)
    }
  },
}

// ============================================
// Panels API
// ============================================

export const panelsApi = {
  list: (params = {}) => api.get('/panels', { params }),
  get: (id) => api.get(`/panels/${id}`),
  create: (data) => api.post('/panels', data),
  update: (id, data) => api.put(`/panels/${id}`, data),
  delete: (id) => api.delete(`/panels/${id}`),

  // Session
  prepare: (id, data = {}) => api.post(`/panels/${id}/prepare`, data),
  start: (id) => api.post(`/panels/${id}/start`, {}),
  end: (id, data = {}) => api.post(`/panels/${id}/end`, data),
  sendMessage: (id, data) => api.post(`/panels/${id}/message`, data),
  getTranscript: (id) => api.get(`/panels/${id}/transcript`),

  // Analysis
  getAnalysis: (id) => api.get(`/panels/${id}/analysis`),
  generateAnalysis: (id) => api.post(`/panels/${id}/analyze`, {}),
  generateFollowups: (id, data) => api.post(`/panels/${id}/generate-followups`, data),

  // Background run
  runBackground: (id) => api.post(`/panels/${id}/background`),
}

// ============================================
// Moderators API
// ============================================

export const moderatorsApi = {
  list: (params = {}) => api.get('/moderators', { params }),
  get: (id) => api.get(`/moderators/${id}`),
  create: (data) => api.post('/moderators', data),
  update: (id, data) => api.put(`/moderators/${id}`, data),
  delete: (id) => api.delete(`/moderators/${id}`),
  setDefault: (id) => api.post(`/moderators/${id}/set-default`),
  generateAvatar: (id, data = {}) => api.post(`/moderators/${id}/generate-avatar`, data),
  generateAvatarStatus: (taskId) => api.get(`/moderators/generate-avatar/${taskId}/status`),
}

// ============================================
// Discussion Guides API
// ============================================

export const discussionGuidesApi = {
  list: (params = {}) => api.get('/discussion-guides', { params }),
  get: (id) => api.get(`/discussion-guides/${id}`),
  create: (data) => api.post('/discussion-guides', data),
  update: (id, data) => api.put(`/discussion-guides/${id}`, data),
  delete: (id) => api.delete(`/discussion-guides/${id}`),
}

// ============================================
// Archetypes API
// ============================================

export const archetypesApi = {
  list: (params = {}) => api.get('/archetypes', { params }),
  get: (id) => api.get(`/archetypes/${id}`),
  create: (data) => api.post('/archetypes', data),
  update: (id, data) => api.put(`/archetypes/${id}`, data),
  delete: (id) => api.delete(`/archetypes/${id}`),

  // Async task-based endpoints (return task_id, poll for result)
  extract: (data) => api.post('/archetypes/extract', data),
  extractStatus: (taskId) => api.get(`/archetypes/extract/${taskId}/status`),
  generate: (id) => api.post(`/archetypes/${id}/generate`),
  generateStatus: (taskId) => api.get(`/archetypes/generate/${taskId}/status`),

  // Helper: dispatch task and poll until complete
  extractAndWait: async (data, onProgress) => {
    const res = await api.post('/archetypes/extract', data)
    const taskId = res.data.task_id
    if (onProgress) onProgress('processing', taskId)

    while (true) {
      await new Promise(r => setTimeout(r, 3000))
      const status = await api.get(`/archetypes/extract/${taskId}/status`)
      const s = status.data

      if (s.status === 'completed') return s.result
      if (s.status === 'failed') throw new Error(s.error || 'Extraction failed')
      if (onProgress) onProgress(s.status, taskId)
    }
  },

  generateAndWait: async (id, onProgress) => {
    const res = await api.post(`/archetypes/${id}/generate`)
    const taskId = res.data.task_id
    if (onProgress) onProgress('processing', taskId)

    while (true) {
      await new Promise(r => setTimeout(r, 2000))
      const status = await api.get(`/archetypes/generate/${taskId}/status`)
      const s = status.data

      if (s.status === 'completed') return s.result
      if (s.status === 'failed') throw new Error(s.error || 'Generation failed')
      if (onProgress) onProgress(s.status, taskId)
    }
  },
}

// ============================================
// Phrase Collections (Dictionaries) API
// ============================================

export const phraseCollectionsApi = {
  list: (params = {}) => api.get('/phrase-collections', { params }),
  get: (id) => api.get(`/phrase-collections/${id}`),
  create: (data) => api.post('/phrase-collections', data),
  update: (id, data) => api.put(`/phrase-collections/${id}`, data),
  delete: (id) => api.delete(`/phrase-collections/${id}`),

  // Phrase management
  addPhrase: (id, data) => api.post(`/phrase-collections/${id}/phrases`, data),
  removePhrase: (id, phraseIndex) => api.delete(`/phrase-collections/${id}/phrases/${phraseIndex}`),

  // AI generation (async task-based)
  generate: (id, data = {}) => api.post(`/phrase-collections/${id}/generate`, data),
  generateStatus: (taskId) => api.get(`/phrase-collections/generate/${taskId}/status`),

  // Helper: dispatch generation and poll until complete
  generateAndWait: async (id, onProgress) => {
    const res = await api.post(`/phrase-collections/${id}/generate`)
    const taskId = res.data.task_id
    if (onProgress) onProgress('processing', taskId)

    while (true) {
      await new Promise(r => setTimeout(r, 3000))
      const status = await api.get(`/phrase-collections/generate/${taskId}/status`)
      const s = status.data

      if (s.status === 'completed') return s.result
      if (s.status === 'failed') throw new Error(s.error || 'Generation failed')
      if (onProgress) onProgress(s.status, taskId)
    }
  },
}

// ============================================
// Voice Library API
// ============================================

export const voiceApi = {
  // Library management (voice presets stored in our DB)
  listLibrary: () => api.get('/voice/voices'),
  getVoice: (id) => api.get(`/voice/voices/${id}`),

  // TTS preview (returns audio/mpeg bytes)
  preview: (data) => api.post('/voice/generate', data, { responseType: 'arraybuffer' }),

  // Voice recommendation
  recommend: (data) => api.post('/voice/recommend', data),

  // Browse ElevenLabs shared library
  browse: (params = {}) => api.get('/voice/browse', { params }),

  // Add a shared voice to our library
  addToLibrary: (data) => api.post('/voice/library', data),

  // Update a library voice
  updateLibraryVoice: (id, data) => api.patch(`/voice/library/${id}`, data),

  // Delete a library voice
  deleteLibraryVoice: (id) => api.delete(`/voice/library/${id}`),
}

// ============================================
// Health API
// ============================================

export const healthApi = {
  check: () => api.get('/health'),
}

export default api
