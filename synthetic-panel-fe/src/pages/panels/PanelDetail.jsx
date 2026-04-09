import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { panelsApi } from '../../services/api'

const statusStyles = {
  draft: { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50', label: 'Draft' },
  ready: { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Ready' },
  active: { dot: 'bg-green-500 animate-pulse', text: 'text-green-700', bg: 'bg-green-50', label: 'Active' },
  completed: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Completed' },
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

function SeverityBadge({ level }) {
  const colors = {
    high: 'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[level] || colors.medium}`}>
      {level}
    </span>
  )
}

function PriorityBadge({ level }) {
  const colors = {
    high: 'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[level] || colors.medium}`}>
      {level}
    </span>
  )
}

function SentimentDot({ sentiment }) {
  const colors = {
    positive: 'bg-emerald-500',
    negative: 'bg-red-500',
    neutral: 'bg-gray-400',
    mixed: 'bg-amber-500',
  }
  return <span className={`w-2 h-2 rounded-full inline-block ${colors[sentiment] || colors.neutral}`} />
}

const sentimentColors = {
  positive: 'border-emerald-200 bg-emerald-50/50',
  negative: 'border-red-200 bg-red-50/50',
  neutral: 'border-gray-200 bg-gray-50/50',
  mixed: 'border-amber-200 bg-amber-50/50',
}

function AnalysisSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-500 font-medium">Generating analysis...</p>
      <p className="text-gray-400 text-sm mt-1">This usually takes 30-60 seconds</p>
    </div>
  )
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt) return '--'
  const start = new Date(startedAt)
  const end = endedAt ? new Date(endedAt) : new Date()
  const diffMs = end - start
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hrs}h ${remainMins}m`
}

export default function PanelDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [panel, setPanel] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const pollRef = useRef(null)

  // Fetch analysis data
  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await panelsApi.getAnalysis(id)
      console.log('[Analysis] Fetch response:', res.data)
      const analyses = res.data?.analyses || []
      // Find the full_analysis type
      const fullAnalysis = analyses.find(a => a.analysis_type === 'full_analysis')
      if (fullAnalysis && fullAnalysis.structured_data && Object.keys(fullAnalysis.structured_data).length > 0) {
        console.log('[Analysis] Found analysis with keys:', Object.keys(fullAnalysis.structured_data))
        setAnalysis(fullAnalysis.structured_data)
        setAnalysisLoading(false)
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        return true
      }
      console.log('[Analysis] No full_analysis found in', analyses.length, 'analyses')
      return false
    } catch (err) {
      console.error('[Analysis] Fetch error:', err)
      return false
    }
  }, [id])

  // Start polling for analysis
  const startPolling = useCallback(() => {
    if (pollRef.current) return
    setAnalysisLoading(true)
    pollRef.current = setInterval(async () => {
      const found = await fetchAnalysis()
      if (found && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }, 5000)
  }, [fetchAnalysis])

  useEffect(() => {
    async function fetchData() {
      try {
        const [panelRes, transcriptRes] = await Promise.all([
          panelsApi.get(id),
          panelsApi.getTranscript(id).catch(() => ({ data: { messages: [] } })),
        ])
        setPanel(panelRes.data)
        setTranscript(transcriptRes.data?.messages || [])

        // If completed, try to fetch analysis
        if (panelRes.data?.status === 'completed') {
          const found = await fetchAnalysis()
          if (!found) {
            // Analysis not ready yet, start polling
            startPolling()
          }
        }
      } catch (error) {
        console.error('Failed to fetch panel:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [id, fetchAnalysis, startPolling])

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

  const handleRegenerateAnalysis = async () => {
    // Clear any existing polling
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    try {
      setAnalysis(null)
      setAnalysisLoading(true)
      await panelsApi.generateAnalysis(id)
      startPolling()

      // Auto-stop polling after 2 minutes to prevent infinite spinner
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
          setAnalysisLoading(false)
        }
      }, 120000)
    } catch (error) {
      console.error('Failed to regenerate analysis:', error)
      setAnalysisLoading(false)
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
  const duration = formatDuration(panel.started_at, panel.ended_at)

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'transcript', label: 'Transcript' },
    { key: 'report', label: 'Report' },
  ]

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
            <button
              onClick={handleRegenerateAnalysis}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition"
            >
              {analysisLoading ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {analysisLoading ? 'Generating...' : analysis ? 'Regenerate Analysis' : 'Generate Analysis'}
            </button>
          )}
          <button
            onClick={async () => {
              if (!window.confirm('Are you sure you want to delete this session? This cannot be undone.')) return
              try {
                await panelsApi.delete(id)
                navigate('/panels')
              } catch (err) {
                console.error('Failed to delete:', err)
                alert('Failed to delete session')
              }
            }}
            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
            title="Delete session"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      {panel.status === 'completed' && (
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* ========== OVERVIEW TAB ========== */}
      {(activeTab === 'overview' || panel.status !== 'completed') && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
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
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{duration}</p>
                  <p className="text-xs text-gray-500">Duration</p>
                </div>
              </div>
            </div>
          </div>

          {panel.status === 'completed' && (
            <>
              {/* Executive Summary */}
              {analysisLoading && !analysis ? (
                <AnalysisSpinner />
              ) : analysis ? (
                <div className="space-y-6">
                  {/* Executive Summary */}
                  <div className="rounded-2xl bg-white border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h2>
                    <p className="text-gray-600 leading-relaxed">{analysis.executive_summary}</p>
                  </div>

                  {/* Key Takeaways */}
                  {analysis.key_takeaways?.length > 0 && (
                    <div className="rounded-2xl bg-white border border-gray-200 p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Takeaways</h2>
                      <div className="space-y-3">
                        {analysis.key_takeaways.map((takeaway, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-gray-700 text-sm leading-relaxed">{takeaway}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Themes */}
                  {analysis.themes?.length > 0 && (
                    <div className="rounded-2xl bg-white border border-gray-200 p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Themes</h2>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {analysis.themes.map((theme, i) => (
                          <div
                            key={i}
                            className={`rounded-xl border p-4 ${sentimentColors[theme.sentiment] || sentimentColors.neutral}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <SentimentDot sentiment={theme.sentiment} />
                              <h3 className="font-medium text-gray-900 text-sm">{theme.name}</h3>
                            </div>
                            <p className="text-gray-600 text-xs leading-relaxed">{theme.description}</p>
                            <p className="text-gray-400 text-xs mt-2 capitalize">{theme.sentiment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Standout Quotes */}
                  {analysis.standout_quotes?.length > 0 && (
                    <div className="rounded-2xl bg-white border border-gray-200 p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Standout Quotes</h2>
                      <div className="space-y-4">
                        {analysis.standout_quotes.map((q, i) => (
                          <div key={i} className="border-l-4 border-primary/30 pl-4">
                            <p className="text-gray-700 italic text-sm">"{q.quote}"</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs font-medium text-gray-900">{q.speaker}</span>
                              <span className="text-xs text-gray-400">{q.significance}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}

          {/* Non-completed panel: show transcript inline */}
          {panel.status !== 'completed' && (
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
                  <TranscriptList messages={transcript} />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ========== TRANSCRIPT TAB ========== */}
      {activeTab === 'transcript' && panel.status === 'completed' && (
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Full Transcript</h2>
            <p className="text-xs text-gray-400 mt-1">{messageCount} messages</p>
          </div>
          <div className="p-6">
            {transcript.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No messages recorded.</p>
            ) : (
              <TranscriptList messages={transcript} />
            )}
          </div>
        </div>
      )}

      {/* ========== REPORT TAB ========== */}
      {activeTab === 'report' && panel.status === 'completed' && (
        <div className="space-y-6">
          {analysisLoading && !analysis ? (
            <AnalysisSpinner />
          ) : analysis ? (
            <>
              {/* Regenerate button */}
              <div className="flex justify-end">
                <button
                  onClick={handleRegenerateAnalysis}
                  disabled={analysisLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {analysisLoading ? 'Regenerating...' : 'Regenerate Analysis'}
                </button>
              </div>

              {/* Executive Summary */}
              <div className="rounded-2xl bg-white border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h2>
                <p className="text-gray-600 leading-relaxed">{analysis.executive_summary}</p>
              </div>

              {/* Key Takeaways */}
              {analysis.key_takeaways?.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Takeaways</h2>
                  <div className="space-y-3">
                    {analysis.key_takeaways.map((t, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-gray-700 text-sm leading-relaxed">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Themes with Sentiment */}
              {analysis.themes?.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Themes</h2>
                  <div className="space-y-3">
                    {analysis.themes.map((theme, i) => (
                      <div key={i} className={`rounded-xl border p-4 ${sentimentColors[theme.sentiment] || sentimentColors.neutral}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <SentimentDot sentiment={theme.sentiment} />
                          <h3 className="font-medium text-gray-900 text-sm">{theme.name}</h3>
                          <span className="text-xs text-gray-400 capitalize ml-auto">{theme.sentiment}</span>
                        </div>
                        <p className="text-gray-600 text-xs leading-relaxed">{theme.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pain Points */}
              {analysis.pain_points?.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Pain Points</h2>
                  <div className="space-y-4">
                    {analysis.pain_points.map((pp, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium text-gray-900 text-sm">{pp.issue}</p>
                          <SeverityBadge level={pp.severity} />
                        </div>
                        {pp.quotes?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {pp.quotes.map((q, qi) => (
                              <p key={qi} className="text-xs text-gray-500 italic pl-3 border-l-2 border-gray-200">"{q}"</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Opportunities */}
              {analysis.opportunities?.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Opportunities</h2>
                  <div className="space-y-3">
                    {analysis.opportunities.map((opp, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-4">
                        <p className="font-medium text-gray-900 text-sm mb-2">{opp.opportunity}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">Impact: <span className="font-medium text-gray-700 capitalize">{opp.impact}</span></span>
                          <span className="text-xs text-gray-500">Effort: <span className="font-medium text-gray-700 capitalize">{opp.effort}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations?.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h2>
                  <div className="space-y-4">
                    {analysis.recommendations.map((rec, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900 text-sm">{rec.recommendation}</p>
                          <PriorityBadge level={rec.priority} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{rec.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standout Quotes */}
              {analysis.standout_quotes?.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Standout Quotes</h2>
                  <div className="space-y-4">
                    {analysis.standout_quotes.map((q, i) => (
                      <div key={i} className="border-l-4 border-primary/30 pl-4">
                        <p className="text-gray-700 italic text-sm">"{q.quote}"</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs font-medium text-gray-900">{q.speaker}</span>
                          <span className="text-xs text-gray-400">{q.significance}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Participant Insights */}
              {analysis.participant_insights?.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Participant Insights</h2>
                  <div className="space-y-3">
                    {analysis.participant_insights.map((pi, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-4 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-purple-700 text-xs font-bold">{pi.name?.charAt(0) || '?'}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 text-sm">{pi.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              pi.engagement === 'high' ? 'bg-emerald-50 text-emerald-700' :
                              pi.engagement === 'low' ? 'bg-gray-100 text-gray-500' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {pi.engagement} engagement
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">{pi.key_perspective}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up Questions */}
              {analysis.follow_up_questions?.length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Suggested Follow-up Questions</h2>
                  <div className="space-y-2">
                    {analysis.follow_up_questions.map((q, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-gray-400 text-sm mt-0.5">{i + 1}.</span>
                        <p className="text-gray-700 text-sm">{q}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No analysis available yet.</p>
              <button
                onClick={handleRegenerateAnalysis}
                className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition"
              >
                Generate Analysis
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TranscriptList({ messages }) {
  const roleConfig = {
    user: {
      align: 'justify-end',
      bubble: 'bg-blue-600 text-white',
      label: 'Researcher',
      labelColor: 'text-blue-200',
      avatar: 'bg-blue-600 text-white',
    },
    moderator: {
      align: 'justify-center',
      bubble: 'bg-cyan-50 border border-cyan-200 text-cyan-900',
      label: 'Moderator',
      labelColor: 'text-cyan-600',
      avatar: 'bg-cyan-100 text-cyan-700',
    },
    persona: {
      align: 'justify-start',
      bubble: 'bg-purple-50 border border-purple-200 text-gray-900',
      label: null,
      labelColor: 'text-purple-600',
      avatar: 'bg-purple-100 text-purple-700',
    },
  }

  return (
    <div className="space-y-4">
      {messages.map((msg, index) => {
        const config = roleConfig[msg.role] || roleConfig.persona
        const personaName = msg.message_metadata?.persona_name || msg.persona_name
        const displayName = msg.role === 'persona' ? personaName : config.label
        const initial = displayName ? displayName.charAt(0).toUpperCase() : '?'
        const ts = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

        return (
          <div key={msg.id || index} className={`flex ${config.align}`}>
            {msg.role !== 'user' && (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mr-2 ${config.avatar}`}>
                <span className="text-xs font-bold">{initial}</span>
              </div>
            )}
            <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${config.bubble}`}>
              {displayName && (
                <div className="flex items-center gap-2 mb-1">
                  <p className={`text-xs font-medium ${config.labelColor}`}>{displayName}</p>
                  {msg.role === 'persona' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">Persona</span>
                  )}
                  {msg.role === 'moderator' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-600 font-medium">Moderator</span>
                  )}
                </div>
              )}
              <p className="text-sm">{msg.content}</p>
              {ts && <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>{ts}</p>}
            </div>
            {msg.role === 'user' && (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ml-2 ${config.avatar}`}>
                <span className="text-xs font-bold">{initial}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
