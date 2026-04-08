import React, { useState, useEffect, useCallback } from 'react'
import { archetypesApi } from '../../services/api'
import { knowledgeGroupsApi, knowledgeSourcesApi } from '../../services/platformApi'

// ============================================
// Constants
// ============================================

const GENERATION_LABELS = {
  GenAlpha: 'Gen Alpha (2010-2024)',
  GenZ: 'Gen Z (1997-2009)',
  Millennial: 'Millennial (1981-1996)',
  GenX: 'Gen X (1965-1980)',
  Boomer: 'Baby Boomer (1946-1964)',
}

const LOCATION_TYPE_LABELS = {
  any: 'Any Location',
  urban: 'Urban',
  suburban: 'Suburban',
  rural: 'Rural',
}

const GENERATION_COLORS = {
  GenAlpha: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', badgeBg: 'bg-purple-50' },
  GenZ: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', badgeBg: 'bg-blue-50' },
  Millennial: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', badgeBg: 'bg-green-50' },
  GenX: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', badgeBg: 'bg-orange-50' },
  Boomer: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', badgeBg: 'bg-amber-50' },
}

const DEFAULT_COLORS = { bg: 'bg-gray-200', text: 'text-gray-600', border: 'border-gray-300', badgeBg: 'bg-gray-50' }

// ============================================
// Helper Functions
// ============================================

function getAgeRangeDisplay(archetype) {
  if (archetype.age_min === undefined && archetype.age_max === undefined &&
      archetype.age_min === null && archetype.age_max === null) {
    return 'All ages'
  }
  if ((archetype.age_min != null) && (archetype.age_max != null)) {
    if (archetype.age_min === archetype.age_max) {
      return `Age ${archetype.age_min}`
    }
    return `Ages ${archetype.age_min}-${archetype.age_max}`
  }
  if (archetype.age_min != null) {
    return `${archetype.age_min}+`
  }
  if (archetype.age_max != null) {
    return `Up to ${archetype.age_max}`
  }
  return 'All ages'
}

function getSourceTypeDisplay(source) {
  if (source.metadata && typeof source.metadata === 'object' && 'research_type' in source.metadata) {
    return 'Deep Research'
  }
  return (source.source_type || '').toUpperCase()
}

function getKnowledgeSizeScale(source) {
  let pages = 0
  if (source.pages) pages = source.pages
  else if (source.page_count) pages = source.page_count
  else if (source.slides) pages = source.slides / 2
  else if (source.sheets) pages = source.sheets * 3
  else if (source.content_text || source.extracted_text) {
    const text = source.content_text || source.extracted_text || ''
    const wordCount = text.split(/\s+/).length
    pages = wordCount / 250
  }
  return Math.max(1, Math.min(10, Math.round(pages / 2.5)))
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ============================================
// KnowledgeSourcePickerModal
// ============================================

function KnowledgeSourcePickerModal({ isOpen, onClose, onConfirm, initialSelectedIds = [] }) {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('a-z')
  const [filterType, setFilterType] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds))

  const fetchSources = useCallback(async () => {
    try {
      const response = await knowledgeSourcesApi.list({ search })
      const data = response.data
      const items = Array.isArray(data) ? data : (data.items || data.sources || data.data || [])
      setSources(items)
    } catch (error) {
      console.error('Error fetching sources:', error)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (isOpen) {
      fetchSources()
    }
  }, [isOpen, fetchSources])

  useEffect(() => {
    setSelectedIds(new Set(initialSelectedIds))
  }, [initialSelectedIds, isOpen])

  if (!isOpen) return null

  const availableTypes = Array.from(new Set(sources.map(s => s.source_type).filter(Boolean)))
  const availableCategories = Array.from(
    new Set(sources.flatMap(s => s.categories || []).filter(Boolean))
  )

  const filteredSources = sources
    .filter(s => filterType === 'all' || s.source_type === filterType)
    .filter(s => filterCategory === 'all' || (s.categories && s.categories.includes(filterCategory)))
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      return a.title.localeCompare(b.title)
    })

  const toggleSelection = (id) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSources.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSources.map(s => s.id)))
    }
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds))
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl max-w-5xl w-full max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Select Knowledge Sources</h2>
            <p className="text-sm text-gray-400">Choose documents to extract archetypes from</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-sm text-gray-900 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Filters Row */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-500">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:border-primary"
              >
                <option value="newest">Newest First</option>
                <option value="a-z">A-Z</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-500">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm text-gray-900 capitalize focus:outline-none focus:border-primary"
              >
                <option value="all">All Types</option>
                {availableTypes.map(type => (
                  <option key={type} value={type} className="capitalize">{type}</option>
                ))}
              </select>
            </div>
            {availableCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-500">Category:</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:border-primary"
                >
                  <option value="all">All Categories</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-primary">{selectedIds.size} selected</span>
            <span className="text-gray-400">|</span>
            <span className="text-sm text-gray-400">{filteredSources.length} documents</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin w-8 h-8 border-4 border-gray-300 border-t-primary rounded-full mb-4"></div>
              <p className="text-gray-400">Loading documents...</p>
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No documents found</h3>
              <p className="text-gray-400">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredSources.length && filteredSources.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 bg-white accent-primary"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Category</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Tags</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Size</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSources.map((source) => {
                  const isSelected = selectedIds.has(source.id)
                  const isProcessing = source.processing_status === 'processing' || source.processing_status === 'pending'
                  const isFailed = source.processing_status === 'failed'
                  return (
                    <tr
                      key={source.id}
                      className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-primary/5' : ''} ${isProcessing ? 'bg-primary/5 opacity-50' : ''} ${isFailed ? 'bg-red-50 opacity-50' : ''}`}
                      onClick={() => !isProcessing && !isFailed && toggleSelection(source.id)}
                    >
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(source.id)}
                          className="w-4 h-4 rounded border-gray-300 bg-white accent-primary"
                          disabled={isProcessing || isFailed}
                        />
                      </td>
                      <td className="px-6 py-4 max-w-[300px]" title={source.title}>
                        {isProcessing ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                            <span className="text-gray-600 truncate" title={source.title}>{source.title}</span>
                          </div>
                        ) : isFailed ? (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-red-600 truncate" title={source.title}>{source.title}</span>
                          </div>
                        ) : (
                          <span className="text-gray-900 font-medium truncate block" title={source.title}>{source.title}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 uppercase">{getSourceTypeDisplay(source)}</td>
                      <td className="px-6 py-4 text-sm">
                        {source.categories && source.categories.length > 0 ? (
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                            {source.categories[0]}
                          </span>
                        ) : (
                          <span className="text-gray-400">&mdash;</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {source.tags && source.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {source.tags.slice(0, 2).map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                                {tag}
                              </span>
                            ))}
                            {source.tags.length > 2 && (
                              <span className="text-gray-400 text-xs">+{source.tags.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">&mdash;</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-1 h-3 rounded-sm ${i < getKnowledgeSizeScale(source) ? 'bg-primary' : 'bg-gray-200'}`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(source.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {selectedIds.size} source{selectedIds.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-500 hover:text-gray-900 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="px-6 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Selection ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// ExtractedArchetypeCard (inline in Extractor)
// ============================================

function ExtractedArchetypeCard({ archetype, isSelected, onToggle }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden transition shadow-sm ${
        isSelected ? 'border-primary' : 'border-gray-200'
      }`}
    >
      <div className="p-4 flex items-start gap-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-5 h-5 mt-1 rounded border-gray-300 bg-white accent-primary"
        />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-lg text-gray-900">{archetype.name}</h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {archetype.generation && (
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    (GENERATION_COLORS[archetype.generation] || DEFAULT_COLORS).bg
                  } ${
                    (GENERATION_COLORS[archetype.generation] || DEFAULT_COLORS).text
                  }`}>
                    {archetype.generation}
                  </span>
                )}
                {archetype.age_min !== undefined && archetype.age_max !== undefined && (
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                    Ages {archetype.age_min}-{archetype.age_max}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-xs ${
                  archetype.confidence === 'high' ? 'bg-green-100 text-green-700' :
                  archetype.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {archetype.confidence} confidence
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-500 hover:text-gray-900"
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {archetype.description && (
            <p className="text-sm text-gray-500 mt-2">{archetype.description}</p>
          )}

          {archetype.driver && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                {archetype.driver}
              </span>
              {archetype.core_value && (
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                  Core: {archetype.core_value}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-200 ml-9 space-y-3">
          {archetype.core_value_detail && (
            <div>
              <p className="text-xs text-gray-400">Core Value Detail</p>
              <p className="text-sm text-gray-700">{archetype.core_value_detail}</p>
            </div>
          )}

          {archetype.key_behaviors && archetype.key_behaviors.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Key Behaviors</p>
              <div className="flex flex-wrap gap-1">
                {archetype.key_behaviors.map((b, i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">{b}</span>
                ))}
              </div>
            </div>
          )}

          {archetype.communication_patterns && Object.keys(archetype.communication_patterns).length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Communication</p>
              <div className="text-sm space-y-1">
                {Object.entries(archetype.communication_patterns).map(([key, value]) => (
                  <div key={key} className="text-gray-700">
                    <span className="text-gray-400">{key}: </span>
                    {value}
                  </div>
                ))}
              </div>
            </div>
          )}

          {archetype.example_quotes && archetype.example_quotes.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Example Quotes</p>
              {archetype.example_quotes.slice(0, 2).map((q, i) => (
                <p key={i} className="text-sm italic text-gray-500">&quot;{q}&quot;</p>
              ))}
            </div>
          )}

          {archetype.source_references && archetype.source_references.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Source References</p>
              {archetype.source_references.slice(0, 2).map((ref, i) => (
                <p key={i} className="text-xs text-gray-400 italic">&quot;{ref}&quot;</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// ArchetypeExtractor
// ============================================

function ArchetypeExtractor({ onSaveArchetypes, onCancel }) {
  const [step, setStep] = useState('select') // 'select' | 'extracting' | 'review'
  const [knowledgeGroups, setKnowledgeGroups] = useState([])
  const [knowledgeSources, setKnowledgeSources] = useState([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  // Selection state
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedSourceIds, setSelectedSourceIds] = useState([])
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  const [selectedGenerations, setSelectedGenerations] = useState([])
  const [ageMin, setAgeMin] = useState(10)
  const [ageMax, setAgeMax] = useState(25)
  const [extractionFocus, setExtractionFocus] = useState('')

  // Extraction results
  const [extractionResult, setExtractionResult] = useState(null)
  const [selectedExtracted, setSelectedExtracted] = useState(new Set())
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [groupsRes, sourcesRes] = await Promise.all([
        knowledgeGroupsApi.list(),
        knowledgeSourcesApi.list(),
      ])
      const groupsData = groupsRes.data
      const sourcesData = sourcesRes.data

      const groups = Array.isArray(groupsData) ? groupsData : (groupsData.groups || groupsData.items || [])
      const sources = Array.isArray(sourcesData) ? sourcesData : (sourcesData.items || sourcesData.sources || sourcesData.data || [])

      setKnowledgeGroups(groups)
      setKnowledgeSources(sources)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setIsLoadingData(false)
    }
  }

  function toggleGeneration(gen) {
    setSelectedGenerations(prev =>
      prev.includes(gen)
        ? prev.filter(g => g !== gen)
        : [...prev, gen]
    )
  }

  async function handleExtract() {
    if (!selectedGroupId && selectedSourceIds.length === 0) {
      setError('Please select a knowledge group or individual sources')
      return
    }

    setIsExtracting(true)
    setError('')
    setStep('extracting')

    try {
      const result = await archetypesApi.extractAndWait({
        knowledge_group_id: selectedGroupId || undefined,
        source_ids: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
        target_generations: selectedGenerations.length > 0 ? selectedGenerations : undefined,
        target_age_range: { min: ageMin, max: ageMax },
        extraction_focus: extractionFocus || undefined,
      })

      setExtractionResult(result)

      // Pre-select all extracted archetypes
      const archetypes = result.extracted_archetypes || []
      setSelectedExtracted(new Set(archetypes.map((_, i) => i)))
      setStep('review')
    } catch (err) {
      console.error('Extraction error:', err)
      setError(err?.response?.data?.error || err?.message || 'Failed to extract archetypes')
      setStep('select')
    } finally {
      setIsExtracting(false)
    }
  }

  async function handleSave() {
    if (!extractionResult || selectedExtracted.size === 0) return

    setIsSaving(true)
    setError('')

    try {
      const archetypesToSave = (extractionResult.extracted_archetypes || [])
        .filter((_, i) => selectedExtracted.has(i))
        .map((ext) => ({
          name: ext.name,
          description: ext.description,
          driver: ext.driver,
          core_value: ext.core_value,
          core_value_detail: ext.core_value_detail,
          key_behaviors: ext.key_behaviors,
          communication_patterns: ext.communication_patterns,
          age_min: ext.age_min,
          age_max: ext.age_max,
          generation: ext.generation,
          demographic_tags: ext.demographic_tags,
          example_quotes: ext.example_quotes,
          example_interests: ext.example_interests,
          source_description: ext.source_references?.join('\n'),
        }))

      await onSaveArchetypes(archetypesToSave)
    } catch (err) {
      console.error('Save error:', err)
      setError(err?.message || 'Failed to save archetypes')
    } finally {
      setIsSaving(false)
    }
  }

  function toggleExtractedSelection(index) {
    setSelectedExtracted((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  if (isLoadingData) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading knowledge sources...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-4 mb-8">
        {['Select Sources', 'Extracting', 'Review & Save'].map((label, i) => {
          const stepIndex = ['select', 'extracting', 'review'].indexOf(step)
          const isActive = i === stepIndex
          const isComplete = i < stepIndex
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isActive ? 'bg-primary text-white' :
                  isComplete ? 'bg-green-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}
              >
                {isComplete ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                  </svg>
                ) : i + 1}
              </div>
              <span className={isActive ? 'text-gray-900' : 'text-gray-500'}>{label}</span>
              {i < 2 && <div className="w-8 h-px bg-gray-300" />}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Step 1: Select Sources */}
      {step === 'select' && (
        <div className="space-y-6">
          {/* Knowledge Group Selection */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Knowledge Group</h3>
            {knowledgeGroups.length === 0 ? (
              <p className="text-gray-500">No knowledge groups available. Create one first.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {knowledgeGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      setSelectedGroupId(group.id === selectedGroupId ? '' : group.id)
                      if (group.id !== selectedGroupId) {
                        setSelectedSourceIds([])
                      }
                    }}
                    className={`p-4 border rounded-lg text-left transition ${
                      selectedGroupId === group.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <h4 className="font-medium text-gray-900">{group.name}</h4>
                    {group.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{group.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">{group.source_count} sources</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Individual Source Selection */}
          {!selectedGroupId && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Or Select Individual Sources</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowSourcePicker(true)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg font-medium transition flex items-center gap-2 text-gray-900"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Select Sources
                </button>
                {selectedSourceIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium">
                      {selectedSourceIds.length} source{selectedSourceIds.length !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => setSelectedSourceIds([])}
                      className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
                      title="Clear selection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              {selectedSourceIds.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-2">Selected sources:</p>
                  <div className="flex flex-wrap gap-2">
                    {knowledgeSources
                      .filter(s => selectedSourceIds.includes(s.id))
                      .slice(0, 5)
                      .map(source => (
                        <span
                          key={source.id}
                          className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs"
                        >
                          {source.title}
                        </span>
                      ))}
                    {selectedSourceIds.length > 5 && (
                      <span className="px-2 py-1 text-gray-400 text-xs">
                        +{selectedSourceIds.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Extraction Options */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Extraction Options</h3>

            {/* Target Generations - Multi-select chips */}
            <div className="mb-6">
              <label className="block text-sm text-gray-500 mb-2">Target Generations</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(GENERATION_LABELS).map(([value, label]) => {
                  const isSelected = selectedGenerations.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleGeneration(value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        isSelected
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900'
                      }`}
                    >
                      {label.split(' (')[0]}
                    </button>
                  )
                })}
              </div>
              {selectedGenerations.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">Select generations to focus on, or leave empty for all</p>
              )}
            </div>

            {/* Age Range Slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-gray-500">Age Range</label>
                <div className="flex items-center gap-1 text-sm">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={ageMin}
                    onChange={(e) => setAgeMin(Math.min(Math.max(0, parseInt(e.target.value) || 0), ageMax))}
                    className="w-12 bg-transparent border-b border-gray-300 focus:border-primary text-center outline-none text-gray-900"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={ageMax}
                    onChange={(e) => setAgeMax(Math.max(Math.min(100, parseInt(e.target.value) || 100), ageMin))}
                    className="w-12 bg-transparent border-b border-gray-300 focus:border-primary text-center outline-none text-gray-900"
                  />
                  <span className="text-gray-400">years</span>
                </div>
              </div>
              <div className="relative h-6 flex items-center">
                <div className="absolute inset-x-0 h-1.5 bg-gray-200 rounded-full" />
                <div
                  className="absolute h-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                  style={{
                    left: `${(ageMin / 100) * 100}%`,
                    right: `${((100 - ageMax) / 100) * 100}%`
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={ageMin}
                  onChange={(e) => setAgeMin(Math.min(Number(e.target.value), ageMax))}
                  className="absolute inset-x-0 h-6 appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-purple-400 [&::-webkit-slider-runnable-track]:bg-transparent"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={ageMax}
                  onChange={(e) => setAgeMax(Math.max(Number(e.target.value), ageMin))}
                  className="absolute inset-x-0 h-6 appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-pink-400 [&::-webkit-slider-runnable-track]:bg-transparent"
                />
              </div>
              <div className="flex justify-between text-xs mt-2 text-gray-400">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>

            {/* Extraction Focus */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">Extraction Focus (Optional)</label>
              <textarea
                value={extractionFocus}
                onChange={(e) => setExtractionFocus(e.target.value)}
                placeholder="Guide the extraction, e.g., 'Focus on digital behaviors and attitudes toward technology'"
                rows={2}
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary resize-none text-gray-900 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 text-gray-500 hover:text-gray-900 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleExtract}
              disabled={!selectedGroupId && selectedSourceIds.length === 0}
              className="px-6 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Extract Archetypes
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Extracting */}
      {step === 'extracting' && (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Extracting Archetypes...</h3>
          <p className="text-gray-500">
            AI is analyzing your documents to identify distinct psychological profiles.
            This may take a minute.
          </p>
        </div>
      )}

      {/* Step 3: Review & Save */}
      {step === 'review' && extractionResult && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Extraction Complete</h3>
            <div className="flex gap-6 text-sm text-gray-500">
              <span>{(extractionResult.extracted_archetypes || []).length} archetypes found</span>
              <span>{extractionResult.sources_analyzed || 0} sources analyzed</span>
              <span>{extractionResult.total_content_analyzed || ''}</span>
            </div>
            {extractionResult.extraction_notes && (
              <p className="mt-3 text-sm text-gray-500 italic">
                {extractionResult.extraction_notes}
              </p>
            )}
          </div>

          {/* Extracted Archetypes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Select Archetypes to Save</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedExtracted(new Set((extractionResult.extracted_archetypes || []).map((_, i) => i)))}
                  className="text-sm text-primary hover:opacity-80"
                >
                  Select All
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={() => setSelectedExtracted(new Set())}
                  className="text-sm text-primary hover:opacity-80"
                >
                  Select None
                </button>
              </div>
            </div>

            {(extractionResult.extracted_archetypes || []).map((archetype, index) => (
              <ExtractedArchetypeCard
                key={index}
                archetype={archetype}
                isSelected={selectedExtracted.has(index)}
                onToggle={() => toggleExtractedSelection(index)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setStep('select')}
              className="px-6 py-2 text-gray-500 hover:text-gray-900 transition"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={selectedExtracted.size === 0 || isSaving}
              className="px-6 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : `Save ${selectedExtracted.size} Archetype${selectedExtracted.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Knowledge Source Picker Modal */}
      <KnowledgeSourcePickerModal
        isOpen={showSourcePicker}
        onClose={() => setShowSourcePicker(false)}
        onConfirm={(ids) => setSelectedSourceIds(ids)}
        initialSelectedIds={selectedSourceIds}
      />
    </div>
  )
}

// ============================================
// ArchetypeForm
// ============================================

function ArchetypeForm({ archetype, onSubmit, onCancel, isLoading = false }) {
  const [formData, setFormData] = useState({
    name: archetype?.name || '',
    description: archetype?.description || '',
    driver: archetype?.driver || '',
    core_value: archetype?.core_value || '',
    core_value_detail: archetype?.core_value_detail || '',
    key_behaviors: archetype?.key_behaviors || [],
    communication_patterns: archetype?.communication_patterns || {},
    age_min: archetype?.age_min,
    age_max: archetype?.age_max,
    generation: archetype?.generation,
    location_type: archetype?.location_type || 'any',
    regions: archetype?.regions || [],
    demographic_tags: archetype?.demographic_tags || [],
    example_name: archetype?.example_name || '',
    example_gender: archetype?.example_gender || '',
    example_quotes: archetype?.example_quotes || [],
    example_interests: archetype?.example_interests || [],
    evolution_from: archetype?.evolution_from || '',
    evolution_shift: archetype?.evolution_shift || '',
  })

  // Temporary input states for array fields
  const [newBehavior, setNewBehavior] = useState('')
  const [newRegion, setNewRegion] = useState('')
  const [newTag, setNewTag] = useState('')
  const [newQuote, setNewQuote] = useState('')
  const [newInterest, setNewInterest] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  const addToArray = (field, value, setter) => {
    if (!value.trim()) return
    const currentArray = formData[field] || []
    if (!currentArray.includes(value.trim())) {
      setFormData({ ...formData, [field]: [...currentArray, value.trim()] })
    }
    setter('')
  }

  const removeFromArray = (field, index) => {
    const currentArray = formData[field] || []
    setFormData({
      ...formData,
      [field]: currentArray.filter((_, i) => i !== index),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Core Identity Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Core Identity</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., The Creator"
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this archetype..."
              rows={2}
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary resize-none text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Demographics Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Demographics</h3>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Age Min</label>
              <input
                type="number"
                min={0}
                max={120}
                value={formData.age_min ?? ''}
                onChange={(e) => setFormData({ ...formData, age_min: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="e.g., 10"
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Age Max</label>
              <input
                type="number"
                min={0}
                max={120}
                value={formData.age_max ?? ''}
                onChange={(e) => setFormData({ ...formData, age_max: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="e.g., 12"
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Generation</label>
              <select
                value={formData.generation || ''}
                onChange={(e) => setFormData({ ...formData, generation: e.target.value || undefined })}
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              >
                <option value="">Any Generation</option>
                {Object.entries(GENERATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Location Type</label>
              <select
                value={formData.location_type || 'any'}
                onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              >
                {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Regions */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Regions</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addToArray('regions', newRegion, setNewRegion)
                  }
                }}
                placeholder="e.g., Germany"
                className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              />
              <button
                type="button"
                onClick={() => addToArray('regions', newRegion, setNewRegion)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition text-gray-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.regions?.map((region, i) => (
                <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1 text-gray-700">
                  {region}
                  <button type="button" onClick={() => removeFromArray('regions', i)} className="text-gray-500 hover:text-gray-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Demographic Tags */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Demographic Tags</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addToArray('demographic_tags', newTag, setNewTag)
                  }
                }}
                placeholder="e.g., tech-native"
                className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              />
              <button
                type="button"
                onClick={() => addToArray('demographic_tags', newTag, setNewTag)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition text-gray-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.demographic_tags?.map((tag, i) => (
                <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1 text-gray-700">
                  #{tag}
                  <button type="button" onClick={() => removeFromArray('demographic_tags', i)} className="text-gray-500 hover:text-gray-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Psychology Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Psychology</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Driver</label>
            <input
              type="text"
              value={formData.driver || ''}
              onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
              placeholder="e.g., Competence & Self-Expression"
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Core Value</label>
              <input
                type="text"
                value={formData.core_value || ''}
                onChange={(e) => setFormData({ ...formData, core_value: e.target.value })}
                placeholder="e.g., Trust"
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Core Value Detail</label>
              <input
                type="text"
                value={formData.core_value_detail || ''}
                onChange={(e) => setFormData({ ...formData, core_value_detail: e.target.value })}
                placeholder="e.g., hates snitches"
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              />
            </div>
          </div>

          {/* Key Behaviors */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Key Behaviors</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newBehavior}
                onChange={(e) => setNewBehavior(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addToArray('key_behaviors', newBehavior, setNewBehavior)
                  }
                }}
                placeholder="e.g., monetizing hobbies"
                className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              />
              <button
                type="button"
                onClick={() => addToArray('key_behaviors', newBehavior, setNewBehavior)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition text-gray-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.key_behaviors?.map((behavior, i) => (
                <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1 text-gray-700">
                  {behavior}
                  <button type="button" onClick={() => removeFromArray('key_behaviors', i)} className="text-gray-500 hover:text-gray-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Communication Patterns */}
          <div>
            <label className="block text-sm text-gray-500 mb-2">Communication Patterns</label>
            <div className="grid gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Speaking Style</label>
                <input
                  type="text"
                  value={formData.communication_patterns?.speaking_style || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    communication_patterns: { ...formData.communication_patterns, speaking_style: e.target.value }
                  })}
                  placeholder="e.g., enthusiastic about interests"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Vocabulary</label>
                <input
                  type="text"
                  value={formData.communication_patterns?.vocabulary || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    communication_patterns: { ...formData.communication_patterns, vocabulary: e.target.value }
                  })}
                  placeholder="e.g., technical when discussing hobbies"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Emotional Expression</label>
                <input
                  type="text"
                  value={formData.communication_patterns?.emotional_expression || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    communication_patterns: { ...formData.communication_patterns, emotional_expression: e.target.value }
                  })}
                  placeholder="e.g., reserved with strangers, open with friends"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Examples Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Example Persona</h3>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Example Name</label>
              <input
                type="text"
                value={formData.example_name || ''}
                onChange={(e) => setFormData({ ...formData, example_name: e.target.value })}
                placeholder="e.g., Jiho"
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Example Gender</label>
              <select
                value={formData.example_gender || ''}
                onChange={(e) => setFormData({ ...formData, example_gender: e.target.value })}
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
              </select>
            </div>
          </div>

          {/* Example Quotes */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Example Quotes</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newQuote}
                onChange={(e) => setNewQuote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addToArray('example_quotes', newQuote, setNewQuote)
                  }
                }}
                placeholder="Something this archetype might say..."
                className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              />
              <button
                type="button"
                onClick={() => addToArray('example_quotes', newQuote, setNewQuote)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition text-gray-700"
              >
                Add
              </button>
            </div>
            <div className="space-y-1">
              {formData.example_quotes?.map((quote, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 italic">&quot;{quote}&quot;</span>
                  <button type="button" onClick={() => removeFromArray('example_quotes', i)} className="text-gray-400 hover:text-gray-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Example Interests */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Example Interests</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addToArray('example_interests', newInterest, setNewInterest)
                  }
                }}
                placeholder="e.g., coding"
                className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              />
              <button
                type="button"
                onClick={() => addToArray('example_interests', newInterest, setNewInterest)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition text-gray-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.example_interests?.map((interest, i) => (
                <span key={i} className="px-2 py-1 bg-primary/10 text-primary rounded text-sm flex items-center gap-1">
                  {interest}
                  <button type="button" onClick={() => removeFromArray('example_interests', i)} className="text-primary/70 hover:text-primary">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Evolution Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolution (Optional)</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Evolved From</label>
            <input
              type="text"
              value={formData.evolution_from || ''}
              onChange={(e) => setFormData({ ...formData, evolution_from: e.target.value })}
              placeholder="Previous archetype name"
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Evolution Shift</label>
            <textarea
              value={formData.evolution_shift || ''}
              onChange={(e) => setFormData({ ...formData, evolution_shift: e.target.value })}
              placeholder="Describe how this archetype evolved..."
              rows={2}
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary resize-none text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-gray-500 hover:text-gray-900 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !formData.name}
          className="px-6 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : archetype ? 'Update Archetype' : 'Create Archetype'}
        </button>
      </div>
    </form>
  )
}

// ============================================
// ArchetypeCard
// ============================================

function ArchetypeCard({
  archetype,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onRegenerate,
  showActions = false,
  compact = false,
  isRegenerating = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const colors = (archetype.generation && GENERATION_COLORS[archetype.generation])
    ? GENERATION_COLORS[archetype.generation]
    : DEFAULT_COLORS
  const ageRange = getAgeRangeDisplay(archetype)

  const handleClick = () => {
    if (onSelect) {
      onSelect(archetype)
    } else {
      setIsExpanded(!isExpanded)
    }
  }

  if (compact) {
    return (
      <div
        onClick={handleClick}
        className={`p-3 bg-white border rounded-lg cursor-pointer transition-all hover:bg-gray-50 shadow-sm ${
          isSelected ? 'ring-2 ring-primary border-primary/50' : 'border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate text-gray-900">{archetype.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-500 text-xs">{ageRange}</span>
              {archetype.generation && (
                <span className={`px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
                  {archetype.generation}
                </span>
              )}
            </div>
          </div>
          {isSelected && (
            <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden transition-all shadow-sm ${colors.border} ${
        isSelected ? 'ring-2 ring-primary/50' : ''
      }`}
    >
      {/* Header */}
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        className="w-full p-4 text-left hover:bg-gray-50 transition cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Name + System badge */}
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-lg truncate text-gray-900">{archetype.name}</h4>
              {archetype.is_system && (
                <span className="px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded text-xs flex-shrink-0">
                  System
                </span>
              )}
            </div>

            {/* Age + Generation row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                {ageRange}
              </span>
              {archetype.generation && (
                <span className={`px-2 py-1 rounded text-xs ${colors.bg} ${colors.text}`}>
                  {archetype.generation}
                </span>
              )}
              {archetype.regions && archetype.regions.length > 0 && (
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">
                  {archetype.regions.slice(0, 2).join(', ')}
                  {archetype.regions.length > 2 && ` +${archetype.regions.length - 2}`}
                </span>
              )}
            </div>

            {/* Driver + Core Value */}
            {(archetype.driver || archetype.core_value) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {archetype.driver && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                    {archetype.driver}
                  </span>
                )}
                {archetype.core_value && (
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                    Core: {archetype.core_value}
                  </span>
                )}
              </div>
            )}

            {/* Tags */}
            {archetype.demographic_tags && archetype.demographic_tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {archetype.demographic_tags.slice(0, 4).map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-400">
                    #{tag}
                  </span>
                ))}
                {archetype.demographic_tags.length > 4 && (
                  <span className="px-1.5 py-0.5 text-xs text-gray-400">
                    +{archetype.demographic_tags.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {showActions && (
              <>
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(archetype)
                    }}
                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded transition"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {onRegenerate && !archetype.is_system && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRegenerate(archetype.id)
                    }}
                    disabled={isRegenerating}
                    className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-200 rounded transition disabled:opacity-50"
                    title="Regenerate with AI"
                  >
                    {isRegenerating ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                )}
                {onDelete && !archetype.is_system && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(archetype)
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-200 rounded transition"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </>
            )}
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4">
          {/* Description */}
          {archetype.description && (
            <div>
              <p className="text-sm text-gray-400">Description</p>
              <p className="text-sm mt-1 text-gray-700">{archetype.description}</p>
            </div>
          )}

          {/* Core Value Detail */}
          {archetype.core_value_detail && (
            <div>
              <p className="text-sm text-gray-400">Core Value Detail</p>
              <p className="text-sm text-gray-700">{archetype.core_value_detail}</p>
            </div>
          )}

          {/* Key Behaviors */}
          {archetype.key_behaviors && archetype.key_behaviors.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Key Behaviors</p>
              <div className="flex flex-wrap gap-1">
                {archetype.key_behaviors.map((behavior, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                    {behavior}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Communication Style */}
          {archetype.communication_patterns && Object.keys(archetype.communication_patterns).length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Communication Style</p>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {archetype.communication_patterns.speaking_style && (
                  <div className="text-gray-700">
                    <span className="text-gray-400">Speaking: </span>
                    {archetype.communication_patterns.speaking_style}
                  </div>
                )}
                {archetype.communication_patterns.vocabulary && (
                  <div className="text-gray-700">
                    <span className="text-gray-400">Vocabulary: </span>
                    {archetype.communication_patterns.vocabulary}
                  </div>
                )}
                {archetype.communication_patterns.emotional_expression && (
                  <div className="text-gray-700">
                    <span className="text-gray-400">Emotional: </span>
                    {archetype.communication_patterns.emotional_expression}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Example Persona */}
          {archetype.example_name && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-400 mb-1">Example Persona</p>
              <p className="text-sm font-medium text-gray-900">
                {archetype.example_name}
                {archetype.example_gender && <span className="text-gray-500"> ({archetype.example_gender})</span>}
              </p>
            </div>
          )}

          {/* Evolution */}
          {archetype.evolution_from && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-400">
                Evolved from <span className="text-gray-900">{archetype.evolution_from}</span>
              </p>
              {archetype.evolution_shift && (
                <p className="text-sm mt-1 text-gray-700">{archetype.evolution_shift}</p>
              )}
            </div>
          )}

          {/* Example Quotes */}
          {archetype.example_quotes && archetype.example_quotes.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Example Quotes</p>
              <div className="space-y-1">
                {archetype.example_quotes.slice(0, 3).map((quote, i) => (
                  <p key={i} className="text-sm italic text-gray-500">&quot;{quote}&quot;</p>
                ))}
              </div>
            </div>
          )}

          {/* Interests */}
          {archetype.example_interests && archetype.example_interests.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Interests</p>
              <div className="flex flex-wrap gap-1">
                {archetype.example_interests.map((interest, i) => (
                  <span key={i} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// Main ArchetypesPage Component
// ============================================

export default function ArchetypeList() {
  const [activeTab, setActiveTab] = useState('builder')
  const [builderMode, setBuilderMode] = useState('ai-extract')

  // Browse state
  const [archetypes, setArchetypes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [searchQuery, setSearchQuery] = useState('')

  // Editor state
  const [editingArchetype, setEditingArchetype] = useState(null)
  const [isFormLoading, setIsFormLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingMessage, setGeneratingMessage] = useState('')

  // Load data
  useEffect(() => {
    loadArchetypes()
  }, [])

  async function loadArchetypes(appliedFilters) {
    setIsLoading(true)
    try {
      const params = {}
      const f = appliedFilters || filters

      if (f.age !== undefined) params.age = f.age
      if (f.generation) params.generation = f.generation
      if (f.search) params.search = f.search

      const res = await archetypesApi.list(params)
      const data = res.data
      setArchetypes(data?.items || data?.archetypes || data || [])
    } catch (err) {
      console.error('Failed to load archetypes:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = useCallback(() => {
    const newFilters = { ...filters, search: searchQuery || undefined }
    setFilters(newFilters)
    loadArchetypes(newFilters)
  }, [filters, searchQuery])

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value || undefined }
    setFilters(newFilters)
    loadArchetypes(newFilters)
  }

  const handleCreateArchetype = async (data) => {
    setIsFormLoading(true)
    setIsGenerating(true)
    setGeneratingMessage('Creating archetype...')
    try {
      const res = await archetypesApi.create(data)
      const newArchetype = res.data

      setShowForm(false)
      setGeneratingMessage('Generating psychological profile with AI...')

      try {
        await archetypesApi.generateAndWait(newArchetype.id, (status) => {
          setGeneratingMessage(`Generating psychological profile... (${status})`)
        })
      } catch (genErr) {
        console.error('Generation failed:', genErr)
      }

      loadArchetypes()
    } catch (err) {
      console.error('Create error:', err)
      alert(err?.response?.data?.error || err?.message || 'Failed to create archetype')
    } finally {
      setIsFormLoading(false)
      setIsGenerating(false)
      setGeneratingMessage('')
    }
  }

  const handleRegenerateArchetype = async (archetypeId) => {
    setIsGenerating(true)
    setGeneratingMessage('Regenerating psychological profile...')
    try {
      await archetypesApi.generateAndWait(archetypeId, (status) => {
        setGeneratingMessage(`Regenerating psychological profile... (${status})`)
      })
      loadArchetypes()
    } catch (err) {
      console.error('Regenerate error:', err)
      alert(err?.response?.data?.error || err?.message || 'Failed to regenerate archetype')
    } finally {
      setIsGenerating(false)
      setGeneratingMessage('')
    }
  }

  const handleUpdateArchetype = async (data) => {
    if (!editingArchetype) return

    setIsFormLoading(true)
    try {
      await archetypesApi.update(editingArchetype.id, data)
      setEditingArchetype(null)
      loadArchetypes()
    } catch (err) {
      console.error('Update error:', err)
      alert(err?.response?.data?.error || err?.message || 'Failed to update archetype')
    } finally {
      setIsFormLoading(false)
    }
  }

  const confirmDeleteArchetype = (archetype) => {
    if (!window.confirm(`Are you sure you want to delete "${archetype.name}"? This action cannot be undone.`)) {
      return
    }
    executeDeleteArchetype(archetype)
  }

  const executeDeleteArchetype = async (archetype) => {
    try {
      await archetypesApi.delete(archetype.id)
      loadArchetypes()
    } catch (err) {
      console.error('Delete error:', err)
      alert(err?.response?.data?.error || err?.message || 'Failed to delete archetype')
    }
  }

  const handleSaveExtractedArchetypes = async (extractedArchetypes) => {
    for (const archetype of extractedArchetypes) {
      await archetypesApi.create(archetype)
    }
    setBuilderMode('manual')
    setActiveTab('browse')
    loadArchetypes()
  }

  // Group archetypes by generation for display
  const groupedArchetypes = archetypes.reduce((acc, archetype) => {
    const gen = archetype.generation || 'Other'
    if (!acc[gen]) acc[gen] = []
    acc[gen].push(archetype)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 relative">
      {/* Generation overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white border border-gray-300 rounded-xl p-6 flex items-center gap-4 shadow-xl">
            <svg className="w-6 h-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-lg text-gray-900">{generatingMessage || 'Generating...'}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Archetype Builder</h1>
          <p className="text-gray-500 mt-1">
            Create and manage psychological archetypes for persona generation
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-6">
            {[
              { id: 'browse', label: 'Browse' },
              { id: 'builder', label: 'Builder' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setShowForm(false)
                  setEditingArchetype(null)
                }}
                className={`py-4 border-b-2 font-medium transition ${
                  activeTab === tab.id
                    ? 'border-primary text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div>
            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
              <div className="flex flex-wrap gap-4">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search archetypes..."
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
                  />
                </div>

                {/* Age filter */}
                <div className="w-24">
                  <input
                    type="number"
                    value={filters.age || ''}
                    onChange={(e) => handleFilterChange('age', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Age"
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
                  />
                </div>

                {/* Generation filter */}
                <select
                  value={filters.generation || ''}
                  onChange={(e) => handleFilterChange('generation', e.target.value || undefined)}
                  className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900"
                >
                  <option value="">All Generations</option>
                  {Object.entries(GENERATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>

                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Results */}
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading archetypes...</div>
            ) : archetypes.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No archetypes found</h3>
                <p className="text-gray-500 mb-4">
                  {Object.values(filters).some(Boolean)
                    ? 'Try adjusting your filters'
                    : 'Create your first archetype or run the migrations'}
                </p>
                <button
                  onClick={() => {
                    setActiveTab('builder')
                    setShowForm(true)
                  }}
                  className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition"
                >
                  Create Archetype
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedArchetypes).map(([gen, genArchetypes]) => {
                  const label = GENERATION_LABELS[gen] || gen

                  return (
                    <div key={gen}>
                      <h3 className="text-lg font-semibold mb-4 text-gray-900">
                        {label}
                        <span className="text-gray-400 font-normal ml-2">({genArchetypes.length})</span>
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {genArchetypes
                          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                          .map((archetype) => (
                            <ArchetypeCard
                              key={archetype.id}
                              archetype={archetype}
                              showActions
                              onEdit={(a) => {
                                setEditingArchetype(a)
                                setActiveTab('builder')
                                setBuilderMode('manual')
                              }}
                              onDelete={confirmDeleteArchetype}
                              onRegenerate={handleRegenerateArchetype}
                              isRegenerating={isGenerating}
                            />
                          ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Builder Tab */}
        {activeTab === 'builder' && (
          <div>
            {/* Mode toggle (only when not editing) */}
            {!editingArchetype && !showForm && (
              <div className="mb-6">
                <div className="inline-flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setBuilderMode('ai-extract')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      builderMode === 'ai-extract' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Create with AI
                  </button>
                  <button
                    onClick={() => setBuilderMode('manual')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      builderMode === 'manual' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>
            )}

            {/* Manual Mode */}
            {builderMode === 'manual' && (
              <>
                {!showForm && !editingArchetype ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Create New Archetype</h3>
                    <p className="text-gray-500 mb-4">
                      Manually define a psychological archetype with demographics, psychology, and examples.
                    </p>
                    <button
                      onClick={() => setShowForm(true)}
                      className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition"
                    >
                      Start Building
                    </button>
                  </div>
                ) : (
                  <ArchetypeForm
                    archetype={editingArchetype || undefined}
                    onSubmit={editingArchetype ? handleUpdateArchetype : handleCreateArchetype}
                    onCancel={() => {
                      setShowForm(false)
                      setEditingArchetype(null)
                    }}
                    isLoading={isFormLoading}
                  />
                )}
              </>
            )}

            {/* AI Extract Mode */}
            {builderMode === 'ai-extract' && (
              <ArchetypeExtractor
                onSaveArchetypes={handleSaveExtractedArchetypes}
                onCancel={() => setBuilderMode('manual')}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
