import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import authService from '../services/authApi'

const AuthContext = createContext(null)

// Allowed origins for postMessage
const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:3002',
  'https://edubites-core.vercel.app',
  'https://platform-fe-theta.vercel.app',
]

// Check if origin is allowed (supports subdomain patterns)
const isAllowedOrigin = (origin) => {
  if (ALLOWED_ORIGINS.includes(origin)) return true

  const patterns = [
    /^https:\/\/[a-z0-9-]+\.edubites\.ai$/,
    /^https:\/\/[a-z0-9-]+\.edubites\.app$/,
    /^https:\/\/[a-z0-9-]+\.edubites\.test$/,
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
  ]

  return patterns.some(pattern => pattern.test(origin))
}

// Check if running in iframe
const isIframeMode = () => {
  try {
    return window.parent !== window
  } catch {
    return true
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [brandData, setBrandData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isIframe, setIsIframe] = useState(false)

  // Request token from parent
  const requestToken = useCallback(() => {
    if (isIframeMode()) {
      window.parent.postMessage({ type: 'REQUEST_TOKEN' }, '*')
    }
  }, [])

  // Request brand data from parent
  const requestBrand = useCallback(() => {
    if (isIframeMode()) {
      window.parent.postMessage({ type: 'REQUEST_BRAND' }, '*')
    }
  }, [])

  // Notify parent of URL changes
  const notifyUrlChange = useCallback(() => {
    if (isIframeMode()) {
      window.parent.postMessage({
        type: 'URL_CHANGE',
        url: window.location.pathname + window.location.search,
      }, '*')
    }
  }, [])

  // Fetch brand colors from organization
  const fetchBrandData = useCallback(async (org) => {
    if (!org?.subdomain) return
    try {
      const res = await authService.getOrgBySubdomain(org.subdomain)
      const orgData = res.data
      const brand = {
        primary_color: orgData.primary_color,
        secondary_color: orgData.secondary_color,
        accent_color: orgData.accent_color,
        logo_url: orgData.logo_url,
        logo_dark_url: orgData.logo_white_url,
      }
      setBrandData(brand)
      localStorage.setItem('synthetic_panel_brand', JSON.stringify(brand))
    } catch (e) {
      console.error('Failed to fetch brand data:', e)
    }
  }, [])

  // Select organization (standalone mode)
  const selectOrganization = useCallback((org) => {
    setOrganization(org)
    if (org) {
      localStorage.setItem('synthetic_panel_org', JSON.stringify(org))
      fetchBrandData(org)
    } else {
      localStorage.removeItem('synthetic_panel_org')
    }
  }, [fetchBrandData])

  // Standalone login via auth-service
  const login = useCallback(async (email, password) => {
    const res = await authService.login(email, password)
    const { access_token, refresh_token } = res.data

    setToken(access_token)
    localStorage.setItem('synthetic_panel_token', access_token)
    if (refresh_token) {
      localStorage.setItem('synthetic_panel_refresh_token', refresh_token)
    }

    // Fetch user profile and resolve organization
    try {
      const meRes = await authService.me(access_token)
      setUser(meRes.data)

      // If user belongs to an org, fetch full org details (with subdomain for branding)
      if (meRes.data.organization_id) {
        try {
          const orgsRes = await authService.organizations(access_token)
          const orgs = orgsRes.data.organizations || orgsRes.data || []
          const orgList = Array.isArray(orgs) ? orgs : [orgs]
          const userOrg = orgList.find(o => o.id === meRes.data.organization_id) || { id: meRes.data.organization_id }
          setOrganization(userOrg)
          localStorage.setItem('synthetic_panel_org', JSON.stringify(userOrg))
          fetchBrandData(userOrg)
        } catch (e) {
          // Fallback to minimal org data
          const orgData = { id: meRes.data.organization_id }
          setOrganization(orgData)
          localStorage.setItem('synthetic_panel_org', JSON.stringify(orgData))
        }
      }
    } catch (e) {
      console.error('Failed to fetch user profile:', e)
    }
  }, [fetchBrandData])

  // Handle incoming messages from parent (iframe mode)
  useEffect(() => {
    const handleMessage = (event) => {
      if (!isAllowedOrigin(event.origin)) {
        console.warn('Message from unauthorized origin:', event.origin)
        return
      }

      const { type, payload } = event.data || {}

      switch (type) {
        case 'AUTH_TOKEN':
          if (payload?.access_token) {
            setToken(payload.access_token)
            setOrganization(payload.organization || null)
            localStorage.setItem('synthetic_panel_token', payload.access_token)
            if (payload.organization) {
              localStorage.setItem('synthetic_panel_org', JSON.stringify(payload.organization))
            }
          }
          break

        case 'BRAND_DATA':
          if (payload) {
            setBrandData(payload)
            localStorage.setItem('synthetic_panel_brand', JSON.stringify(payload))
          }
          break

        case 'LOGOUT':
          setToken(null)
          setUser(null)
          setOrganization(null)
          localStorage.removeItem('synthetic_panel_token')
          localStorage.removeItem('synthetic_panel_org')
          break

        default:
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Initialize on mount
  useEffect(() => {
    const iframe = isIframeMode()
    setIsIframe(iframe)

    if (iframe) {
      requestToken()
      requestBrand()

      const timeout = setTimeout(() => {
        setIsLoading(false)
      }, 3000)

      return () => clearTimeout(timeout)
    } else {
      // Standalone mode - restore from localStorage
      const savedToken = localStorage.getItem('synthetic_panel_token')
      const savedOrg = localStorage.getItem('synthetic_panel_org')
      const savedBrand = localStorage.getItem('synthetic_panel_brand')

      if (savedToken) {
        setToken(savedToken)
      }

      let parsedOrg = null
      if (savedOrg) {
        try {
          parsedOrg = JSON.parse(savedOrg)
          setOrganization(parsedOrg)
        } catch (e) {
          console.error('Failed to parse saved organization')
        }
      }

      if (savedBrand) {
        try {
          setBrandData(JSON.parse(savedBrand))
        } catch (e) {
          console.error('Failed to parse saved brand data')
        }
      } else if (parsedOrg) {
        // No cached brand — fetch from org
        fetchBrandData(parsedOrg)
      }

      setIsLoading(false)
    }
  }, [requestToken, requestBrand])

  // Update loading state when token is received
  useEffect(() => {
    if (token) {
      setIsLoading(false)
    }
  }, [token])

  // Check token expiry periodically
  useEffect(() => {
    if (!isIframe || !token) return

    const checkTokenExpiry = () => {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const expiresAt = payload.exp * 1000
        const now = Date.now()
        const timeUntilExpiry = expiresAt - now

        if (timeUntilExpiry < 8 * 60 * 1000) {
          requestToken()
        }
      } catch (e) {
        console.error('Failed to decode token:', e)
      }
    }

    const interval = setInterval(checkTokenExpiry, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [isIframe, token, requestToken])

  // Logout function
  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setOrganization(null)
    setBrandData(null)
    localStorage.removeItem('synthetic_panel_token')
    localStorage.removeItem('synthetic_panel_refresh_token')
    localStorage.removeItem('synthetic_panel_org')
    localStorage.removeItem('synthetic_panel_brand')
  }, [])

  const value = {
    token,
    user,
    organization,
    brandData,
    isLoading,
    isIframe,
    isAuthenticated: !!token,
    hasOrganization: !!organization,
    login,
    logout,
    selectOrganization,
    requestToken,
    notifyUrlChange,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
