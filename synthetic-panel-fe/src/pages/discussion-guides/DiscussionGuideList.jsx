import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { discussionGuidesApi } from '../../services/api'

function getTotalQuestions(guide) {
  if (!guide.sections) return 0
  return guide.sections.reduce((sum, s) => sum + (s.questions?.length || 0), 0)
}

function getTotalDuration(guide) {
  if (!guide.sections) return 0
  return guide.sections.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
}

function getAllQuestions(guide) {
  if (!guide.sections) return []
  return guide.sections.flatMap(s => s.questions || [])
}

function DiscussionGuideList() {
  const [guides, setGuides] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await discussionGuidesApi.list()
        setGuides(response.data.items || response.data || [])
      } catch (error) {
        console.error('Failed to fetch discussion guides:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this discussion guide? This action cannot be undone.')) return
    try {
      await discussionGuidesApi.delete(id)
      setGuides(guides.filter(g => g.id !== id))
    } catch (error) {
      console.error('Failed to delete discussion guide:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discussion Guides</h1>
            <p className="text-gray-500 mt-1">
              Structured question flows to guide your panel conversations
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : guides.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No discussion guides yet</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Create structured question flows to guide your panel sessions and ensure comprehensive coverage of topics.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {guides.map((guide) => {
              const totalQuestions = getTotalQuestions(guide)
              const totalDuration = getTotalDuration(guide)
              const allQuestions = getAllQuestions(guide)
              const previewQuestions = allQuestions.slice(0, 3)
              const remainingCount = allQuestions.length - 3

              return (
                <div
                  key={guide.id}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left content */}
                    <div className="flex-1 min-w-0">
                      {/* Title + badges */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {guide.name}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'}
                        </span>
                        {totalDuration > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {totalDuration} min
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {guide.description && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                          {guide.description}
                        </p>
                      )}

                      {/* Preview questions */}
                      {previewQuestions.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {previewQuestions.map((question, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium flex items-center justify-center mt-0.5">
                                {idx + 1}
                              </span>
                              <span className="text-sm text-gray-600">
                                {question}
                              </span>
                            </div>
                          ))}
                          {remainingCount > 0 && (
                            <p className="text-xs text-gray-400 ml-7">
                              +{remainingCount} more {remainingCount === 1 ? 'question' : 'questions'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        to={`/discussion-guides/${guide.id}/edit`}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </Link>
                      <button
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors"
                        onClick={() => handleDelete(guide.id)}
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
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

export default DiscussionGuideList
