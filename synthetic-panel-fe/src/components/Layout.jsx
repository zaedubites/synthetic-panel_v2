import React, { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function SwitchOrgButton() {
  const navigate = useNavigate()
  const { organization, selectOrganization } = useAuth()

  const handleSwitch = () => {
    // Clear org so the select-organization page shows
    selectOrganization(null)
    localStorage.removeItem('synthetic_panel_org')
    localStorage.removeItem('synthetic_panel_brand')
    navigate('/select-organization')
  }

  return (
    <button
      onClick={handleSwitch}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      <span className="truncate">{organization?.name || 'Switch Org'}</span>
    </button>
  )
}

const navItems = [
  {
    name: 'Dashboard',
    path: '/',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    name: 'Panels',
    path: '/panels',
    icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    matchPaths: ['/panels'],
    children: [
      { name: 'All Sessions', path: '/panels' },
      { name: 'New Session', path: '/panels/new' },
      { name: 'Moderators', path: '/moderators' },
    ],
  },
  {
    name: 'Personas',
    path: '/personas',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    matchPaths: ['/personas', '/archetypes', '/voice-library', '/dictionaries'],
    children: [
      { name: 'All Personas', path: '/personas' },
      { name: 'Archetypes', path: '/archetypes' },
      { name: 'Voice Library', path: '/voice-library' },
      { name: 'Dictionaries', path: '/dictionaries' },
    ],
  },
]

function Layout({ hideHeader = false }) {
  const { organization, isIframe, logout } = useAuth()
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState(['Panels', 'Personas'])

  const isActive = (item) => {
    if (item.path === '/' && location.pathname === '/') return true
    if (item.path === '/') return false
    if (item.matchPaths) {
      return item.matchPaths.some(p => location.pathname.startsWith(p))
    }
    return location.pathname.startsWith(item.path)
  }

  const isSubActive = (path) => {
    if (path === '/panels' && location.pathname === '/panels') return true
    if (path === '/personas' && location.pathname === '/personas') return true
    return location.pathname.startsWith(path) && path !== '/panels' && path !== '/personas'
  }

  const toggleExpand = (name) => {
    setExpandedItems(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
        {/* Title */}
        <div className="p-4 border-b border-gray-200">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900 hover:text-primary transition-colors">
              Synthetic Panel
            </span>
          </NavLink>
          {organization?.name && (
            <p className="text-xs text-gray-400 mt-1 truncate">{organization.name}</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item)
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedItems.includes(item.name)

            if (hasChildren) {
              return (
                <div key={item.name}>
                  <button
                    onClick={() => toggleExpand(item.name)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                      {item.name}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="mt-1 ml-4 pl-4 border-l border-gray-200 space-y-1">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            isSubActive(child.path)
                              ? 'text-primary bg-primary/5'
                              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          {child.name}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive: navActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    navActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.name}
              </NavLink>
            )
          })}
        </nav>

        {/* User Section — local dev only */}
        {!isIframe && (
          <div className="p-4 border-t border-gray-200 space-y-1">
            <SwitchOrgButton />
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-6">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
