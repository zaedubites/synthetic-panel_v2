import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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

export default function PanelDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [panel, setPanel] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [panelRes, transcriptRes] = await Promise.all([
          panelsApi.get(id),
          panelsApi.getTranscript(id).catch(() => ({ data: { messages: [] } })),
        ])
        setPanel(panelRes.data)
        setTranscript(transcriptRes.data?.messages || [])
      } catch (error) {
        console.error('Failed to fetch panel:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handlePrepare = async () => {
    setActionLoading(true)
    try {
      await panelsApi.prepare(id)
      const response = await panelsApi.get(id)
      setPanel(response.data)
    } catch (error) {
      console.error('Failed to prepare panel:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleStart = async () => {
    setActionLoading(true)
    try {
      await panelsApi.start(id)
      navigate(`/panels/${id}/live`)
    } catch (error) {
      console.error('Failed to start panel:', error)
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!panel) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Panel not found</p>
        <Link to="/panels" className="text-primary hover:opacity-80 font-medium">&larr; Back to Panels</Link>
      </div>
    )
  }

  const participantCount = panel.participant_ids?.length || 0
  const messageCount = transcript.length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Link */}
      <Link to="/panels" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Panels
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={panel.status} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {panel.name || 'Untitled Panel'}
          </h1>
          {panel.research_goal && (
            <p className="text-gray-500 mt-1">{panel.research_goal}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {panel.status === 'draft' && (
            <button
              onClick={handlePrepare}
              disabled={actionLoading}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50"
            >
              {actionLoading ? 'Preparing...' : 'Prepare Session'}
            </button>
          )}
          {panel.status === 'ready' && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50"
            >
              {actionLoading ? 'Starting...' : 'Start Session'}
            </button>
          )}
          {panel.status === 'active' && (
            <Link
              to={`/panels/${id}/live`}
              className="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition"
            >
              Join Live
            </Link>
          )}
          {panel.status === 'completed' && (
            <Link
              to={`/panels/${id}`}
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition"
            >
              View Analysis
            </Link>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{participantCount}</p>
              <p className="text-xs text-gray-500">Participants</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{messageCount}</p>
              <p className="text-xs text-gray-500">Messages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transcript Section */}
      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Transcript</h2>
        </div>
        <div className="p-6">
          {transcript.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No messages yet. {panel.status === 'ready' ? 'Start the session to begin the conversation.' : panel.status === 'draft' ? 'Prepare and start the session to begin.' : ''}
            </p>
          ) : (
            <div className="space-y-4">
              {transcript.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'moderator' ? 'justify-center' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-white'
                        : msg.role === 'moderator'
                        ? 'bg-blue-50 text-blue-900'
                        : 'bg-gray-50 border border-gray-200 text-gray-900'
                    }`}
                  >
                    {msg.role === 'persona' && msg.persona_name && (
                      <p className="text-xs font-medium text-gray-500 mb-1">{msg.persona_name}</p>
                    )}
                    {msg.role === 'moderator' && (
                      <p className="text-xs font-medium text-blue-500 mb-1">Moderator</p>
                    )}
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
