import React, { useState, useEffect, useCallback } from 'react'
import { phraseCollectionsApi } from '../../services/api'

// ============================================
// Constants
// ============================================

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'it', label: 'Italian' },
]

const GENERATIONS = [
  { value: 'gen_alpha', label: 'Gen Alpha' },
  { value: 'gen_z', label: 'Gen Z' },
  { value: 'millennial', label: 'Millennial' },
  { value: 'gen_x', label: 'Gen X' },
  { value: 'boomer', label: 'Boomer' },
]

const AGE_RANGES = [
  { value: '6-9', label: '6-9 years' },
  { value: '10-12', label: '10-12 years' },
  { value: '10-14', label: '10-14 years' },
  { value: '13-15', label: '13-15 years' },
  { value: '13-17', label: '13-17 years' },
  { value: '16-19', label: '16-19 years' },
]

const PHRASE_CATEGORIES = [
  'affirmation',
  'negation',
  'greeting',
  'exclamation',
  'adjective',
  'insult',
  'compliment',
  'expression',
]

const FORMALITY_LEVELS = [
  { value: 'casual', label: 'Casual' },
  { value: 'very_casual', label: 'Very Casual' },
  { value: 'neutral', label: 'Neutral' },
]

const LANGUAGE_COLORS = {
  en: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  de: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  es: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  fr: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  it: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
}

const GENERATION_COLORS = {
  gen_alpha: { bg: 'bg-purple-50', text: 'text-purple-700' },
  gen_z: { bg: 'bg-blue-50', text: 'text-blue-700' },
  millennial: { bg: 'bg-green-50', text: 'text-green-700' },
  gen_x: { bg: 'bg-orange-50', text: 'text-orange-700' },
  boomer: { bg: 'bg-amber-50', text: 'text-amber-700' },
}

const CATEGORY_COLORS = {
  affirmation: 'bg-green-50 text-green-700',
  negation: 'bg-red-50 text-red-700',
  greeting: 'bg-blue-50 text-blue-700',
  exclamation: 'bg-yellow-50 text-yellow-700',
  adjective: 'bg-indigo-50 text-indigo-700',
  insult: 'bg-rose-50 text-rose-700',
  compliment: 'bg-teal-50 text-teal-700',
  expression: 'bg-gray-100 text-gray-700',
}

const FORMALITY_COLORS = {
  casual: 'bg-sky-50 text-sky-700',
  very_casual: 'bg-pink-50 text-pink-700',
  neutral: 'bg-gray-100 text-gray-600',
}

function getLanguageLabel(code) {
  const lang = LANGUAGES.find(l => l.value === code)
  return lang ? lang.label : code
}

function getGenerationLabel(gen) {
  const g = GENERATIONS.find(g => g.value === gen)
  return g ? g.label : gen
}

// ============================================
// Confirm Modal
// ============================================

function ConfirmModal({ isOpen, title, message, confirmText, cancelText, variant, onConfirm, onCancel }) {
  if (!isOpen) return null

  const confirmClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-primary hover:opacity-90 text-white'

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-xl">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            {cancelText || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${confirmClass}`}
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Create Dictionary Modal
// ============================================

function CreateDictionaryModal({ onClose, onCreate, isGenerating }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    language: 'en',
    generation: '',
    region: '',
    city: '',
    age_range: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isGenerating) return
    if (!formData.name.trim()) return

    const payload = { ...formData }
    // Remove empty optional fields
    if (!payload.generation) delete payload.generation
    if (!payload.region) delete payload.region
    if (!payload.city) delete payload.city
    if (!payload.age_range) delete payload.age_range

    onCreate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-xl">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-lg text-gray-900">Create Dictionary</h2>
          {!isGenerating && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Gen Alpha Slang, Berlin Dialect"
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this phrase collection..."
              rows={2}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Generation</label>
              <select
                value={formData.generation}
                onChange={(e) => setFormData({ ...formData, generation: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                <option value="">All Generations</option>
                {GENERATIONS.map(gen => (
                  <option key={gen.value} value={gen.value}>{gen.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age Range</label>
              <select
                value={formData.age_range}
                onChange={(e) => setFormData({ ...formData, age_range: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                <option value="">All Ages</option>
                {AGE_RANGES.map(age => (
                  <option key={age.value} value={age.value}>{age.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
              <input
                type="text"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="e.g., Germany, US"
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="e.g., Berlin, Munich"
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-3 bg-primary hover:opacity-90 disabled:opacity-50 text-white rounded-xl font-medium transition flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating & Generating Phrases...
              </>
            ) : (
              'Create Dictionary'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

// ============================================
// Add Phrase Modal
// ============================================

function AddPhraseModal({ onClose, onAdd }) {
  const [formData, setFormData] = useState({
    phrase: '',
    meaning: '',
    category: '',
    formality: 'casual',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.phrase.trim() || !formData.meaning.trim()) return

    const payload = { ...formData }
    if (!payload.category) delete payload.category

    onAdd(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-xl">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-lg text-gray-900">Add Phrase</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phrase *</label>
            <input
              type="text"
              value={formData.phrase}
              onChange={(e) => setFormData({ ...formData, phrase: e.target.value })}
              placeholder="e.g., no cap, sus, slay"
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meaning *</label>
            <textarea
              value={formData.meaning}
              onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
              placeholder="What does this phrase mean?"
              rows={2}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-gray-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                <option value="">Select category</option>
                {PHRASE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Formality</label>
              <select
                value={formData.formality}
                onChange={(e) => setFormData({ ...formData, formality: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                {FORMALITY_LEVELS.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-primary hover:opacity-90 text-white rounded-xl font-medium transition"
          >
            Add Phrase
          </button>
        </form>
      </div>
    </div>
  )
}

// ============================================
// Main Dictionary List Page
// ============================================

export default function DictionaryList() {
  const [collections, setCollections] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddPhraseModal, setShowAddPhraseModal] = useState(null)

  // Filters
  const [languageFilter, setLanguageFilter] = useState('')
  const [generationFilter, setGenerationFilter] = useState('')

  // Delete modals
  const [showDeletePhraseModal, setShowDeletePhraseModal] = useState(false)
  const [deletePhraseTarget, setDeletePhraseTarget] = useState(null)
  const [showDeleteCollectionModal, setShowDeleteCollectionModal] = useState(false)
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingId, setGeneratingId] = useState(null)

  const loadCollections = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = { page_size: 100 }
      if (languageFilter) params.language = languageFilter
      if (generationFilter) params.generation = generationFilter

      const res = await phraseCollectionsApi.list(params)
      setCollections(res.data.items || [])
    } catch (error) {
      console.error('Failed to load collections:', error)
    } finally {
      setIsLoading(false)
    }
  }, [languageFilter, generationFilter])

  useEffect(() => {
    loadCollections()
  }, [loadCollections])

  async function createCollection(data) {
    setIsGenerating(true)
    try {
      // Step 1: Create the collection
      const res = await phraseCollectionsApi.create(data)
      const newCollection = res.data

      setShowCreateModal(false)
      setGeneratingId(newCollection.id)

      // Add collection with empty phrases first
      setCollections(prev => [newCollection, ...prev])
      setExpandedId(newCollection.id)

      // Step 2: Generate phrases via celery task
      try {
        const result = await phraseCollectionsApi.generateAndWait(newCollection.id, (status) => {
          // progress callback - could update UI
        })

        if (result && result.phrases) {
          // Reload to get updated data
          const updated = await phraseCollectionsApi.get(newCollection.id)
          setCollections(prev => prev.map(c =>
            c.id === newCollection.id ? updated.data : c
          ))
        }
      } catch (genError) {
        console.error('Failed to generate phrases:', genError)
      }
    } catch (error) {
      console.error('Failed to create collection:', error)
      alert('Failed to create dictionary')
    } finally {
      setIsGenerating(false)
      setGeneratingId(null)
    }
  }

  async function regeneratePhrases(collectionId) {
    setIsGenerating(true)
    setGeneratingId(collectionId)
    try {
      const result = await phraseCollectionsApi.generateAndWait(collectionId, (status) => {
        // progress callback
      })

      if (result && result.phrases) {
        // Reload to get updated data
        const updated = await phraseCollectionsApi.get(collectionId)
        setCollections(prev => prev.map(c =>
          c.id === collectionId ? updated.data : c
        ))
      }
    } catch (error) {
      console.error('Failed to generate phrases:', error)
      alert('Failed to generate phrases')
    } finally {
      setIsGenerating(false)
      setGeneratingId(null)
    }
  }

  async function addPhrase(collectionId, phrase) {
    try {
      const res = await phraseCollectionsApi.addPhrase(collectionId, phrase)
      setCollections(prev => prev.map(c =>
        c.id === collectionId ? res.data : c
      ))
      setShowAddPhraseModal(null)
    } catch (error) {
      console.error('Failed to add phrase:', error)
      alert('Failed to add phrase')
    }
  }

  function confirmDeletePhrase(collectionId, phraseIndex, phraseText) {
    setDeletePhraseTarget({ collectionId, phraseIndex, phraseText })
    setShowDeletePhraseModal(true)
  }

  async function executeDeletePhrase() {
    if (!deletePhraseTarget) return
    try {
      setIsDeleting(true)
      const res = await phraseCollectionsApi.removePhrase(
        deletePhraseTarget.collectionId,
        deletePhraseTarget.phraseIndex
      )
      setCollections(prev => prev.map(c =>
        c.id === deletePhraseTarget.collectionId ? res.data : c
      ))
    } catch (error) {
      console.error('Failed to delete phrase:', error)
    } finally {
      setIsDeleting(false)
      setShowDeletePhraseModal(false)
      setDeletePhraseTarget(null)
    }
  }

  function confirmDeleteCollection(collection) {
    setDeleteCollectionTarget(collection)
    setShowDeleteCollectionModal(true)
  }

  async function executeDeleteCollection() {
    if (!deleteCollectionTarget) return
    try {
      setIsDeleting(true)
      await phraseCollectionsApi.delete(deleteCollectionTarget.id)
      setCollections(prev => prev.filter(c => c.id !== deleteCollectionTarget.id))
    } catch (error) {
      console.error('Failed to delete collection:', error)
    } finally {
      setIsDeleting(false)
      setShowDeleteCollectionModal(false)
      setDeleteCollectionTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dictionaries</h1>
          <p className="text-gray-500 mt-1">Manage phrase collections for persona speech patterns</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Dictionary
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl border border-gray-200">
        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-700"
        >
          <option value="">All Languages</option>
          {LANGUAGES.map(lang => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
        <select
          value={generationFilter}
          onChange={(e) => setGenerationFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-700"
        >
          <option value="">All Generations</option>
          {GENERATIONS.map(gen => (
            <option key={gen.value} value={gen.value}>{gen.label}</option>
          ))}
        </select>
        {(languageFilter || generationFilter) && (
          <button
            onClick={() => {
              setLanguageFilter('')
              setGenerationFilter('')
            }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto text-sm text-gray-400">
          {collections.length} dictionaries
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading dictionaries...
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No dictionaries yet</h3>
          <p className="text-gray-500 mb-6">Create your first dictionary to define slang and phrases for personas</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition"
          >
            Create Dictionary
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
            >
              {/* Collection Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setExpandedId(expandedId === collection.id ? null : collection.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900">{collection.name}</h3>
                    </div>
                    {collection.description && (
                      <p className="text-gray-500 text-sm mb-3">{collection.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                        (LANGUAGE_COLORS[collection.language] || { bg: 'bg-gray-100', text: 'text-gray-600' }).bg
                      } ${
                        (LANGUAGE_COLORS[collection.language] || { bg: 'bg-gray-100', text: 'text-gray-600' }).text
                      }`}>
                        {getLanguageLabel(collection.language)}
                      </span>
                      {collection.generation && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          (GENERATION_COLORS[collection.generation] || { bg: 'bg-gray-100', text: 'text-gray-600' }).bg
                        } ${
                          (GENERATION_COLORS[collection.generation] || { bg: 'bg-gray-100', text: 'text-gray-600' }).text
                        }`}>
                          {getGenerationLabel(collection.generation)}
                        </span>
                      )}
                      {collection.region && (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
                          {collection.region}
                        </span>
                      )}
                      {collection.city && (
                        <span className="px-2 py-1 bg-cyan-50 text-cyan-700 rounded text-xs font-medium">
                          {collection.city}
                        </span>
                      )}
                      {collection.age_range && (
                        <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                          Age {collection.age_range}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                        {(collection.phrases || []).length} phrases
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        confirmDeleteCollection(collection)
                      }}
                      className="p-2 hover:bg-red-50 rounded-lg transition text-gray-400 hover:text-red-500"
                      title="Delete dictionary"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${expandedId === collection.id ? 'rotate-180' : ''}`}
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
              {expandedId === collection.id && (
                <div className="border-t border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-500">Phrases</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => regeneratePhrases(collection.id)}
                        disabled={isGenerating}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-50 rounded-lg text-sm font-medium transition flex items-center gap-2"
                      >
                        {generatingId === collection.id ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Generate with AI
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowAddPhraseModal(collection.id)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Phrase
                      </button>
                    </div>
                  </div>

                  {collection.phrases && collection.phrases.length > 0 ? (
                    <div className="space-y-2">
                      {collection.phrases.map((phrase, index) => (
                        <div
                          key={index}
                          className="flex items-start justify-between gap-4 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg group transition"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-gray-900">"{phrase.phrase}"</span>
                              {phrase.is_trending && (
                                <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-xs font-medium">
                                  Trending
                                </span>
                              )}
                              {phrase.category && (
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  CATEGORY_COLORS[phrase.category] || 'bg-gray-100 text-gray-600'
                                }`}>
                                  {phrase.category}
                                </span>
                              )}
                              {phrase.formality && (
                                <span className={`px-1.5 py-0.5 rounded text-xs ${
                                  FORMALITY_COLORS[phrase.formality] || 'bg-gray-100 text-gray-500'
                                }`}>
                                  {phrase.formality}
                                </span>
                              )}
                              {phrase.popularity_score != null && (
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                                  Score: {phrase.popularity_score}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm">{phrase.meaning}</p>
                            {phrase.example && (
                              <p className="text-gray-400 text-xs mt-1 italic">"{phrase.example}"</p>
                            )}
                          </div>
                          <button
                            onClick={() => confirmDeletePhrase(collection.id, index, phrase.phrase)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition text-gray-400 hover:text-red-500"
                            title="Remove phrase"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : generatingId === collection.id ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating phrases with AI...
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p className="mb-3">No phrases yet.</p>
                      <button
                        onClick={() => regeneratePhrases(collection.id)}
                        disabled={isGenerating}
                        className="px-4 py-2 bg-primary hover:opacity-90 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition"
                      >
                        Generate Phrases with AI
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateDictionaryModal
          onClose={() => !isGenerating && setShowCreateModal(false)}
          onCreate={createCollection}
          isGenerating={isGenerating}
        />
      )}

      {showAddPhraseModal && (
        <AddPhraseModal
          onClose={() => setShowAddPhraseModal(null)}
          onAdd={(phrase) => addPhrase(showAddPhraseModal, phrase)}
        />
      )}

      <ConfirmModal
        isOpen={showDeletePhraseModal}
        title="Remove Phrase"
        message={`Are you sure you want to remove "${deletePhraseTarget?.phraseText}"?`}
        confirmText={isDeleting ? 'Removing...' : 'Remove'}
        cancelText="Cancel"
        variant="danger"
        onConfirm={executeDeletePhrase}
        onCancel={() => {
          setShowDeletePhraseModal(false)
          setDeletePhraseTarget(null)
        }}
      />

      <ConfirmModal
        isOpen={showDeleteCollectionModal}
        title="Delete Dictionary"
        message={`Are you sure you want to delete "${deleteCollectionTarget?.name}" and all its phrases? This action cannot be undone.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        variant="danger"
        onConfirm={executeDeleteCollection}
        onCancel={() => {
          setShowDeleteCollectionModal(false)
          setDeleteCollectionTarget(null)
        }}
      />
    </div>
  )
}
