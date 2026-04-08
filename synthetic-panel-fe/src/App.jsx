import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@eduBITES/edubites-design-system'

import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import SelectOrganization from './pages/SelectOrganization'

// Pages
import Dashboard from './pages/Dashboard'
import PersonaList from './pages/personas/PersonaList'
import PersonaNew from './pages/personas/PersonaNew'
import PersonaDetail from './pages/personas/PersonaDetail'
import PanelList from './pages/panels/PanelList'
import PanelNew from './pages/panels/PanelNew'
import PanelDetail from './pages/panels/PanelDetail'
import PanelLive from './pages/panels/PanelLive'
import ModeratorList from './pages/moderators/ModeratorList'
import ModeratorNew from './pages/moderators/ModeratorNew'
import ModeratorDetail from './pages/moderators/ModeratorDetail'
import DiscussionGuideList from './pages/discussion-guides/DiscussionGuideList'
import ArchetypeList from './pages/archetypes/ArchetypeList'
import VoiceLibrary from './pages/voice-library/VoiceLibrary'
import DictionaryList from './pages/dictionaries/DictionaryList'

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, hasOrganization, isLoading, isIframe } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Standalone mode: redirect to login or org select
  if (!isIframe) {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />
    }
    if (!hasOrganization) {
      return <Navigate to="/select-organization" replace />
    }
  }

  // Iframe mode: show message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Authentication Required
        </h1>
        <p className="text-gray-600">
          Please access this application through the EduBites platform.
        </p>
      </div>
    )
  }

  return children
}

// Branded theme provider
function BrandedThemeProvider({ children }) {
  const { brandData } = useAuth()

  const primary = brandData?.primary_color || '#5845BA'
  const secondary = brandData?.secondary_color || '#2CE080'
  const tertiary = brandData?.accent_color || '#9061F9'

  // Key forces remount when brand colors change so ThemeProvider re-initializes
  const themeKey = `${primary}-${secondary}-${tertiary}`

  return (
    <ThemeProvider
      key={themeKey}
      disablePersistence
      initialPrimary={primary}
      initialSecondary={secondary}
      initialTertiary={tertiary}
      initialLogoLight={brandData?.logo_url}
      initialLogoDark={brandData?.logo_dark_url}
    >
      {children}
    </ThemeProvider>
  )
}

// Main app content
function AppContent() {
  const { isIframe, isAuthenticated, hasOrganization } = useAuth()

  return (
    <BrandedThemeProvider>
      <Routes>
        {/* Standalone auth routes (only when not in iframe) */}
        {!isIframe && (
          <>
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to={hasOrganization ? '/' : '/select-organization'} replace /> : <Login />}
            />
            <Route
              path="/select-organization"
              element={
                !isAuthenticated
                  ? <Navigate to="/login" replace />
                  : hasOrganization
                    ? <Navigate to="/" replace />
                    : <SelectOrganization />
              }
            />
          </>
        )}

        {/* Main app routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          {/* Personas */}
          <Route path="personas" element={<PersonaList />} />
          <Route path="personas/new" element={<PersonaNew />} />
          <Route path="personas/:id" element={<PersonaDetail />} />

          {/* Panels */}
          <Route path="panels" element={<PanelList />} />
          <Route path="panels/new" element={<PanelNew />} />
          <Route path="panels/:id" element={<PanelDetail />} />
          <Route path="panels/:id/live" element={<PanelLive />} />

          {/* Moderators */}
          <Route path="moderators/new" element={<ModeratorNew />} />
          <Route path="moderators/:id" element={<ModeratorDetail />} />
          <Route path="moderators" element={<ModeratorList />} />

          {/* Discussion Guides */}
          <Route path="discussion-guides" element={<DiscussionGuideList />} />

          {/* Archetypes */}
          <Route path="archetypes" element={<ArchetypeList />} />

          {/* Voice Library */}
          <Route path="voice-library" element={<VoiceLibrary />} />

          {/* Dictionaries */}
          <Route path="dictionaries" element={<DictionaryList />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrandedThemeProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
