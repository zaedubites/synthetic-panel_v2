import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { panelsApi } from '../../services/api'

const statusStyles = {
  draft: { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50', label: 'Draft' },
  ready: { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Ready' },
  active: { dot: 'bg-green-500 animate-pulse', text: 'text-green-700', bg: 'bg-green-50', label: 'Active' },
  completed: { dot: 'bg-primary', text: 'text-primary', bg: 'bg-primary/10', label: 'Completed' },
}

function StatusBadge({ status }) {
  const style = statusStyles[status] || statusStyles.draft
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}

export default function PanelList() {
  const [panels, setPanels] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    async function fetchPanels() {
      try {
        setLoading(true)
        const params = { page_size: 50 }
        if (statusFilter !== 'all') params.status = statusFilter
        if (search) params.search = search

        const response = await panelsApi.list(params)
        setPanels(response.data?.items || response.data || [])
      } catch (error) {
        console.error('Failed to fetch panels:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchPanels()
  }, [statusFilter, search])

  const filteredPanels = panels

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Sessions</h1>
          <p className="text-gray-500 mt-1">Manage and monitor your focus group sessions</p>
        </div>
        <Link
          to="/panels/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Panel
        </Link>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search panels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredPanels.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No panel sessions yet</h3>
          <p className="text-gray-500 mb-6">Create your first panel to start running focus groups</p>
          <Link
            to="/panels/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Panel
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPanels.map((panel) => (
            <Link
              key={panel.id}
              to={`/panels/${panel.id}`}
              className="group rounded-2xl bg-white border border-gray-200 p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <StatusBadge status={panel.status} />
                <svg className="w-4 h-4 text-gray-300 group-hover:text-primary transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary transition line-clamp-2">
                {panel.research_goal || panel.name || 'Untitled Panel'}
              </h3>
              {panel.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-4">{panel.description}</p>
              )}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {new Date(panel.created_at).toLocaleDateString()}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {panel.participant_ids?.length || 0}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
