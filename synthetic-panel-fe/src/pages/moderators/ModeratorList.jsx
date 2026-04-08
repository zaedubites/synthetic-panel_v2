import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { moderatorsApi } from '../../services/api'

const TYPE_COLORS = {
  professional: { bg: 'bg-blue-100', text: 'text-blue-700' },
  empath: { bg: 'bg-pink-100', text: 'text-pink-700' },
  challenger: { bg: 'bg-orange-100', text: 'text-orange-700' },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-600' },
  energizer: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  expert: { bg: 'bg-purple-100', text: 'text-purple-700' },
}

function getTypeColor(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.neutral
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '?'
}

const GRADIENT_COLORS = [
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-pink-400 to-pink-600',
  'from-teal-400 to-teal-600',
  'from-indigo-400 to-indigo-600',
  'from-emerald-400 to-emerald-600',
]

function getGradient(name) {
  const index = name ? name.charCodeAt(0) % GRADIENT_COLORS.length : 0
  return GRADIENT_COLORS[index]
}

function ModeratorList() {
  const navigate = useNavigate()
  const [moderators, setModerators] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await moderatorsApi.list()
        setModerators(response.data.items || response.data || [])
      } catch (error) {
        console.error('Failed to fetch moderators:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSetDefault = async (id) => {
    try {
      await moderatorsApi.setDefault(id)
      setModerators(moderators.map(m => ({
        ...m,
        is_default: m.id === id,
      })))
    } catch (error) {
      console.error('Failed to set default:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this moderator? This action cannot be undone.')) return
    try {
      await moderatorsApi.delete(id)
      setModerators(moderators.filter(m => m.id !== id))
    } catch (error) {
      console.error('Failed to delete moderator:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Moderators</h1>
            <p className="text-gray-500 mt-1">
              Manage AI moderators that guide your panel discussions
            </p>
          </div>
          <Link
            to="/moderators/new"
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Moderator
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : moderators.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No moderators yet</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Create your first AI moderator to guide panel discussions with different styles and personalities.
            </p>
            <Link
              to="/moderators/new"
              className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              New Moderator
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {moderators.map((mod) => {
              const typeColor = getTypeColor(mod.moderation_style || mod.type)

              return (
                <div
                  key={mod.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/moderators/${mod.id}`)}
                >
                  {/* Square avatar area */}
                  <div className="relative aspect-square bg-gray-100">
                    {mod.avatar_url ? (
                      <img
                        src={mod.avatar_url}
                        alt={mod.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getGradient(mod.name)}`}>
                        <span className="text-6xl font-bold text-white/90">
                          {getInitial(mod.name)}
                        </span>
                      </div>
                    )}

                    {/* Default badge - top left */}
                    <button
                      className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        mod.is_default
                          ? 'bg-green-500 text-white'
                          : 'bg-white/80 text-gray-600 hover:bg-white'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSetDefault(mod.id)
                      }}
                    >
                      {mod.is_default ? 'Default' : 'Set Default'}
                    </button>

                    {/* Type badge - top right */}
                    {(mod.moderation_style || mod.type) && (
                      <span
                        className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${typeColor.bg} ${typeColor.text}`}
                      >
                        {mod.moderation_style || mod.type}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {mod.name}
                    </h3>
                    {(mod.description || mod.bio) && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {mod.description || mod.bio}
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 pb-4">
                    <button
                      className="w-full px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(mod.id)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ModeratorList
