import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { personasApi, voiceApi, phraseCollectionsApi } from '../../services/api'

// ============================================
// Helper: safely parse JSON fields stored as strings
// ============================================
function parseJsonField(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return typeof value === 'string' ? value : null
  }
}

// Get text from a field that might be a string or {description: "..."} object
function getFieldText(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed.description || parsed.consumption_habits || JSON.stringify(parsed, null, 2)
      }
      return value
    } catch {
      return value
    }
  }
  if (typeof value === 'object') {
    return value.description || value.consumption_habits || ''
  }
  return String(value)
}

// ============================================
// Reusable: Tag Input
// ============================================
function TagInput({ tags = [], onAdd, onRemove, color = 'blue', placeholder = 'Add...' }) {
  const [input, setInput] = useState('')

  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      onAdd(input.trim())
      setInput('')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colorMap[color] || colorMap.blue}`}
          >
            {tag}
            <button
              onClick={() => onRemove(i)}
              className="ml-0.5 hover:opacity-70 transition"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
      />
    </div>
  )
}

// ============================================
// Reusable: Toggle Button Group
// ============================================
function ToggleButtons({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
            value === opt
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ============================================
// Reusable: Range Slider
// ============================================
function RangeSlider({ label, lowLabel, highLabel, value, onChange, min = 1, max = 5 }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {value || min}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value || min}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-gray-400">{lowLabel}</span>
        <span className="text-[10px] text-gray-400">{highLabel}</span>
      </div>
    </div>
  )
}

// ============================================
// Reusable: Collapsible Textarea
// ============================================
function CollapsibleTextarea({ label, value, onChange, onBlur, placeholder, rows = 4, saving }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary font-medium transition mb-1"
      >
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {label}
        {saving && <span className="text-primary animate-pulse text-[10px]">saving...</span>}
      </button>
      {open && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
        />
      )}
    </div>
  )
}

// ============================================
// Default ElevenLabs voices
// ============================================
const DEFAULT_VOICES = [
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm female' },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Energetic female' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Soft female' },
  { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Conversational male' },
  { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Deep male' },
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Neutral male' },
]

// ============================================
// Helper: build nested update payload from dot-path
// ============================================
function buildUpdatePayload(path, value) {
  const parts = path.split('.')
  if (parts.length === 1) return { [path]: value }

  const result = {}
  let current = result
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {}
    current = current[parts[i]]
  }
  current[parts[parts.length - 1]] = value
  return result
}

// ============================================
// Helper: get nested value from object
// ============================================
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined
    // Auto-parse JSON strings when traversing
    if (typeof acc[key] === 'string') {
      try {
        const parsed = JSON.parse(acc[key])
        if (typeof parsed === 'object' && parsed !== null) {
          acc[key] = parsed // Cache the parsed result
          return parsed
        }
      } catch { /* not JSON */ }
    }
    return acc[key]
  }, obj)
}

// ============================================
// Main Component
// ============================================
export default function PersonaDetail() {
  const { id } = useParams()
  const [persona, setPersona] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [generating, setGenerating] = useState(null)
  const [availableVoices, setAvailableVoices] = useState([])
  const [showVoiceSelector, setShowVoiceSelector] = useState(false)
  const [previewingVoice, setPreviewingVoice] = useState(null)
  const [dictionaries, setDictionaries] = useState([])
  const [allDictionaries, setAllDictionaries] = useState([])
  const [showDictPicker, setShowDictPicker] = useState(false)

  // Inline editing state
  const [editedFields, setEditedFields] = useState({})
  const [savingField, setSavingField] = useState(null)

  // Parse JSON fields from persona
  const parsed = React.useMemo(() => {
    if (!persona) return {}
    const p = parseJsonField(persona.personality) || {}
    const c = parseJsonField(persona.consumer_habits) || {}
    const w = parseJsonField(persona.worldview) || {}
    const vs = parseJsonField(persona.voice_settings) || {}
    return {
      // Personality
      personalityText: typeof p === 'string' ? p : (p.description || ''),
      profileNotes: typeof p === 'object' ? (p.profile_notes || '') : '',
      interests: typeof p === 'object' ? (p.interests || []) : [],
      // Consumer habits
      consumptionHabits: typeof c === 'string' ? c : (c.consumption_habits || ''),
      decisionStyle: c.decision_style || '',
      brandLoyalty: c.brand_loyalty || '',
      favoriteBrands: c.favorite_brands || [],
      socialMedia: c.social_media_platforms || [],
      purchaseInfluencers: c.purchase_influencers || [],
      dailyRoutine: c.daily_routine || '',
      // Worldview
      worldviewText: typeof w === 'string' ? w : (w.description || ''),
      thingsTheyKnow: w.things_they_know || [],
      thingsTheyDontKnow: w.things_they_dont_know || [],
      beliefs: w.beliefs || [],
      misconceptions: w.misconceptions || [],
      // Speaking behavior & backstory elements (stored in voice_settings)
      speakingBehavior: vs.speaking_behavior || { confidence: 3, verbosity: 3, enthusiasm: 3, formality: 3 },
      backstoryElements: vs.backstory_elements || {},
    }
  }, [persona])

  const audioRef = useRef(new Audio())

  // ------------------------------------------
  // Data fetching
  // ------------------------------------------
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await personasApi.get(id)
        setPersona(response.data)
      } catch (error) {
        console.error('Failed to fetch persona:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    voiceApi.listLibrary().then(res => {
      setAvailableVoices(res.data?.voices || res.data || [])
    }).catch(() => {})

    phraseCollectionsApi.list().then(res => {
      setAllDictionaries(res.data?.items || res.data || [])
    }).catch(() => {})
  }, [id])

  // Sync assigned dictionaries when persona loads
  useEffect(() => {
    if (persona?.dictionary_ids && allDictionaries.length > 0) {
      const assigned = allDictionaries.filter(d =>
        (persona.dictionary_ids || []).includes(d.id || d._id)
      )
      setDictionaries(assigned)
    }
  }, [persona?.dictionary_ids, allDictionaries])

  // ------------------------------------------
  // Inline field editing
  // ------------------------------------------
  const getFieldValue = useCallback((path) => {
    if (editedFields[path] !== undefined) return editedFields[path]
    return getNestedValue(persona, path) ?? ''
  }, [editedFields, persona])

  const handleFieldChange = useCallback((path, value) => {
    setEditedFields(prev => ({ ...prev, [path]: value }))
  }, [])

  const handleFieldBlur = useCallback(async (path) => {
    const value = editedFields[path]
    if (value === undefined) return

    const original = getNestedValue(persona, path)
    if (value === original) {
      setEditedFields(prev => { const n = { ...prev }; delete n[path]; return n })
      return
    }

    setSavingField(path)
    try {
      await personasApi.update(id, buildUpdatePayload(path, value))
      const res = await personasApi.get(id)
      setPersona(res.data)
      setEditedFields(prev => { const n = { ...prev }; delete n[path]; return n })
    } catch (error) {
      console.error(`Failed to save ${path}:`, error)
    } finally {
      setSavingField(null)
    }
  }, [editedFields, persona, id])

  // Direct save (no blur pattern, e.g. toggles, sliders)
  const saveField = useCallback(async (path, value) => {
    setSavingField(path)
    try {
      await personasApi.update(id, buildUpdatePayload(path, value))
      const res = await personasApi.get(id)
      setPersona(res.data)
    } catch (error) {
      console.error(`Failed to save ${path}:`, error)
    } finally {
      setSavingField(null)
    }
  }, [id])

  // ------------------------------------------
  // Speaking behavior helpers
  // ------------------------------------------
  const getSpeakingValue = (key) => {
    if (editedFields[`speaking_behavior.${key}`] !== undefined) return editedFields[`speaking_behavior.${key}`]
    return parsed.speakingBehavior?.[key] ?? 3
  }

  const handleSpeakingChange = useCallback(async (key, value) => {
    const updated = { ...(parsed.speakingBehavior || {}), [key]: value }
    setSavingField(`speaking_behavior.${key}`)
    try {
      await personasApi.update(id, { speaking_behavior: updated })
      const res = await personasApi.get(id)
      setPersona(res.data)
    } catch (error) {
      console.error('Failed to save speaking behavior:', error)
    } finally {
      setSavingField(null)
    }
  }, [id, persona?.speaking_behavior])

  // ------------------------------------------
  // Tag array helpers
  // ------------------------------------------
  const handleAddTag = useCallback(async (path, tag) => {
    const current = getNestedValue(persona, path) || []
    const updated = [...current, tag]
    await saveField(path, updated)
  }, [persona, saveField])

  const handleRemoveTag = useCallback(async (path, index) => {
    const current = getNestedValue(persona, path) || []
    const updated = current.filter((_, i) => i !== index)
    await saveField(path, updated)
  }, [persona, saveField])

  // ------------------------------------------
  // Voice
  // ------------------------------------------
  const handleChangeVoice = async (voiceId, voiceName) => {
    try {
      await personasApi.update(id, { voice_id: voiceId, voice_name: voiceName })
      setPersona(prev => ({ ...prev, voice_id: voiceId, voice_name: voiceName }))
      setShowVoiceSelector(false)
    } catch (error) {
      console.error('Failed to update voice:', error)
    }
  }

  const handlePreviewVoice = async (voiceId) => {
    if (previewingVoice === voiceId) {
      audioRef.current.pause()
      setPreviewingVoice(null)
      return
    }
    setPreviewingVoice(voiceId)
    try {
      const res = await voiceApi.preview({
        text: `Hi, my name is ${persona?.name || 'someone'}. Nice to meet you!`,
        voice_id: voiceId,
      })
      const blob = new Blob([res.data], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      audioRef.current.src = url
      audioRef.current.onended = () => { URL.revokeObjectURL(url); setPreviewingVoice(null) }
      await audioRef.current.play()
    } catch {
      setPreviewingVoice(null)
    }
  }

  // ------------------------------------------
  // Dictionaries
  // ------------------------------------------
  const handleAssignDictionary = async (dict) => {
    const currentIds = persona?.dictionary_ids || []
    const dictId = dict.id || dict._id
    if (currentIds.includes(dictId)) return
    const updated = [...currentIds, dictId]
    await saveField('dictionary_ids', updated)
    setShowDictPicker(false)
  }

  const handleRemoveDictionary = async (dictId) => {
    const currentIds = persona?.dictionary_ids || []
    const updated = currentIds.filter(dId => dId !== dictId)
    await saveField('dictionary_ids', updated)
  }

  // ------------------------------------------
  // Avatar generation
  // ------------------------------------------
  const handleGenerateAvatar = async () => {
    setGenerating('avatar')
    try {
      const response = await personasApi.generateAvatar(id, {})
      setPersona(response.data)
    } catch (error) {
      console.error('Failed to generate avatar:', error)
    } finally {
      setGenerating(null)
    }
  }

  const handleGenerateProfile = async () => {
    setGenerating('profile')
    try {
      const response = await personasApi.generateProfile(id)
      setPersona(response.data)
    } catch (error) {
      console.error('Failed to generate profile:', error)
    } finally {
      setGenerating(null)
    }
  }

  const handleGenerateBackstory = async () => {
    setGenerating('backstory')
    try {
      const response = await personasApi.generateBackstory(id, {})
      setPersona(response.data)
    } catch (error) {
      console.error('Failed to generate backstory:', error)
    } finally {
      setGenerating(null)
    }
  }

  // ------------------------------------------
  // Worldview array helpers
  // ------------------------------------------
  const getWorldviewItems = (field) => {
    // Map field names to parsed data
    const fieldMap = {
      things_they_know: parsed.thingsTheyKnow,
      things_they_dont_know: parsed.thingsTheyDontKnow,
      beliefs: parsed.beliefs,
      beliefs_opinions: parsed.beliefs,
      misconceptions: parsed.misconceptions,
    }
    const val = fieldMap[field] || persona?.[field]
    if (Array.isArray(val)) return val
    if (typeof val === 'string' && val.trim()) return val.split('\n\n').filter(Boolean)
    return []
  }

  const getWorldviewText = (field) => {
    const items = getWorldviewItems(field)
    if (items.length > 0) return items.join('\n\n')
    return ''
  }

  // ------------------------------------------
  // Loading / Error states
  // ------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!persona) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Persona not found</p>
        <Link to="/personas" className="text-primary hover:opacity-80 font-medium">&larr; Back to Personas</Link>
      </div>
    )
  }

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'life', label: 'Life & Story' },
    { key: 'worldview', label: 'Worldview' },
  ]

  const savingIndicator = (path) =>
    savingField === path ? <span className="text-[10px] text-primary animate-pulse ml-1">saving...</span> : null

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Back Link */}
        <Link to="/personas" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Personas
        </Link>

        {/* ============================================ */}
        {/* HEADER */}
        {/* ============================================ */}
        <div className="rounded-2xl bg-white border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0 group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100">
                {persona.avatar_url ? (
                  <img src={persona.avatar_url} alt={persona.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary via-tertiary to-secondary flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">{(persona.name || '?')[0].toUpperCase()}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleGenerateAvatar}
                disabled={generating === 'avatar'}
                className="absolute inset-0 w-24 h-24 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title="Regenerate Avatar"
              >
                {generating === 'avatar' ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={getFieldValue('name')}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  onBlur={() => handleFieldBlur('name')}
                  className="text-2xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 p-0 w-full min-w-0"
                />
                {persona.archetype_name && (
                  <span className="flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {persona.archetype_name}
                  </span>
                )}
                {savingIndicator('name')}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                {persona.age && <span>{persona.age} years old</span>}
                {(persona.city || persona.country) && (
                  <span>{[persona.city, persona.country].filter(Boolean).join(', ')}</span>
                )}
                {persona.gender && <span className="capitalize">{persona.gender}</span>}
              </div>

              {/* Voice Row */}
              <div className="mt-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {persona.voice_id ? (
                  <span className="text-sm text-gray-600">{persona.voice_name || persona.voice_id}</span>
                ) : (
                  <span className="text-sm text-gray-400 italic">No voice</span>
                )}
                <button
                  onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                  className="text-xs text-primary hover:opacity-80 font-medium ml-1"
                >
                  {showVoiceSelector ? 'Cancel' : 'Change'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* TABS */}
        {/* ============================================ */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
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

        {/* ============================================ */}
        {/* TAB 1: PROFILE */}
        {/* ============================================ */}
        {activeTab === 'profile' && (
          <div className="space-y-6">

            {/* Section 1: Avatar & Quick Info */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Quick Info</h2>
                <button
                  onClick={handleGenerateProfile}
                  disabled={generating === 'profile'}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm font-medium text-gray-700 rounded-xl hover:border-primary hover:text-primary transition disabled:opacity-50"
                >
                  {generating === 'profile' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate Profile
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-6">
                {/* Large avatar */}
                <div className="flex-shrink-0 relative group">
                  <div className="w-72 h-72 rounded-2xl overflow-hidden bg-gray-100">
                    {persona.avatar_url ? (
                      <img src={persona.avatar_url} alt={persona.name} className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary via-tertiary to-secondary flex items-center justify-center">
                        <span className="text-6xl font-bold text-white">{(persona.name || '?')[0].toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleGenerateAvatar}
                    disabled={generating === 'avatar'}
                    className="absolute inset-0 w-72 h-72 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    {generating === 'avatar' ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="flex flex-col items-center text-white">
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-xs font-medium">Regenerate</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Fields grid */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Name {savingIndicator('name')}</label>
                    <input
                      type="text"
                      value={getFieldValue('name')}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      onBlur={() => handleFieldBlur('name')}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    />
                  </div>

                  {/* Profile Notes */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Profile Notes {savingIndicator('profile_notes')}</label>
                    <textarea
                      rows={3}
                      value={getFieldValue('profile_notes')}
                      onChange={(e) => handleFieldChange('profile_notes', e.target.value)}
                      onBlur={() => handleFieldBlur('profile_notes')}
                      placeholder="Additional notes about this persona..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
                    />
                  </div>

                  {/* Age */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Age {savingIndicator('age')}</label>
                    <input
                      type="number"
                      value={getFieldValue('age')}
                      onChange={(e) => handleFieldChange('age', e.target.value ? parseInt(e.target.value, 10) : '')}
                      onBlur={() => handleFieldBlur('age')}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Gender {savingIndicator('gender')}</label>
                    <select
                      value={getFieldValue('gender')}
                      onChange={(e) => { handleFieldChange('gender', e.target.value); saveField('gender', e.target.value) }}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    >
                      <option value="">Select...</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="non-binary">Non-binary</option>
                    </select>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">City {savingIndicator('city')}</label>
                    <input
                      type="text"
                      value={getFieldValue('city')}
                      onChange={(e) => handleFieldChange('city', e.target.value)}
                      onBlur={() => handleFieldBlur('city')}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Country {savingIndicator('country')}</label>
                    <input
                      type="text"
                      value={getFieldValue('country')}
                      onChange={(e) => handleFieldChange('country', e.target.value)}
                      onBlur={() => handleFieldBlur('country')}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    />
                  </div>

                  {/* Location Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Location Type {savingIndicator('location_type')}</label>
                    <select
                      value={getFieldValue('location_type')}
                      onChange={(e) => { handleFieldChange('location_type', e.target.value); saveField('location_type', e.target.value) }}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    >
                      <option value="">Select...</option>
                      <option value="urban">Urban</option>
                      <option value="suburban">Suburban</option>
                      <option value="small-town">Small Town</option>
                      <option value="rural">Rural</option>
                    </select>
                  </div>

                  {/* Family Situation */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Family Situation {savingIndicator('family_situation')}</label>
                    <input
                      type="text"
                      value={getFieldValue('family_situation')}
                      onChange={(e) => handleFieldChange('family_situation', e.target.value)}
                      onBlur={() => handleFieldBlur('family_situation')}
                      placeholder="e.g. Married with two kids"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Interests */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Interests {savingIndicator('interests')}</h3>
              <TagInput
                tags={Array.isArray(persona.interests) ? persona.interests : (persona.interests ? persona.interests.split(',').map(s => s.trim()).filter(Boolean) : [])}
                onAdd={(tag) => handleAddTag('interests', tag)}
                onRemove={(i) => handleRemoveTag('interests', i)}
                color="blue"
                placeholder="Type an interest and press Enter..."
              />
            </div>

            {/* Section 3: Personality Traits */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Personality Traits</h3>

              <div className="space-y-4">
                {/* Personality */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Personality {savingIndicator('personality')}</label>
                  <p className="text-sm text-gray-700 leading-relaxed mb-1">
                    {parsed.personalityText || <span className="text-gray-400 italic">Not generated yet</span>}
                  </p>
                  <CollapsibleTextarea
                    label="Edit personality"
                    value={getFieldValue('personality')}
                    onChange={(v) => handleFieldChange('personality', v)}
                    onBlur={() => handleFieldBlur('personality')}
                    placeholder="Describe their personality..."
                    rows={3}
                    saving={savingField === 'personality'}
                  />
                </div>

                {/* Quirks */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Quirks</label>
                  {(Array.isArray(persona.quirks) ? persona.quirks : []).length > 0 ? (
                    <ul className="space-y-1 mb-2">
                      {(Array.isArray(persona.quirks) ? persona.quirks : []).map((quirk, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
                          {quirk}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 italic mb-2">No quirks defined</p>
                  )}
                  <CollapsibleTextarea
                    label="Edit quirks (one per line)"
                    value={getFieldValue('quirks_text') !== '' ? getFieldValue('quirks_text') : (Array.isArray(persona.quirks) ? persona.quirks.join('\n') : '')}
                    onChange={(v) => handleFieldChange('quirks_text', v)}
                    onBlur={async () => {
                      const raw = editedFields['quirks_text']
                      if (raw === undefined) return
                      const items = raw.split('\n').map(s => s.trim()).filter(Boolean)
                      setSavingField('quirks')
                      try {
                        await personasApi.update(id, { quirks: items })
                        const res = await personasApi.get(id)
                        setPersona(res.data)
                        setEditedFields(prev => { const n = { ...prev }; delete n['quirks_text']; return n })
                      } finally {
                        setSavingField(null)
                      }
                    }}
                    placeholder="One quirk per line..."
                    rows={4}
                    saving={savingField === 'quirks'}
                  />
                </div>

                {/* Catchphrases */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Catchphrases</label>
                  {(Array.isArray(persona.catchphrases) ? persona.catchphrases : []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(Array.isArray(persona.catchphrases) ? persona.catchphrases : []).map((phrase, i) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                          &ldquo;{phrase}&rdquo;
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic mb-2">No catchphrases defined</p>
                  )}
                  <CollapsibleTextarea
                    label="Edit catchphrases (one per line)"
                    value={getFieldValue('catchphrases_text') !== '' ? getFieldValue('catchphrases_text') : (Array.isArray(persona.catchphrases) ? persona.catchphrases.join('\n') : '')}
                    onChange={(v) => handleFieldChange('catchphrases_text', v)}
                    onBlur={async () => {
                      const raw = editedFields['catchphrases_text']
                      if (raw === undefined) return
                      const items = raw.split('\n').map(s => s.trim()).filter(Boolean)
                      setSavingField('catchphrases')
                      try {
                        await personasApi.update(id, { catchphrases: items })
                        const res = await personasApi.get(id)
                        setPersona(res.data)
                        setEditedFields(prev => { const n = { ...prev }; delete n['catchphrases_text']; return n })
                      } finally {
                        setSavingField(null)
                      }
                    }}
                    placeholder="One catchphrase per line..."
                    rows={4}
                    saving={savingField === 'catchphrases'}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Consumer Habits */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Consumer Habits</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Consumption Habits */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Consumption Habits {savingIndicator('consumer_habits.consumption_habits')}
                  </label>
                  <textarea
                    rows={3}
                    value={getFieldValue('consumer_habits.consumption_habits') || parsed.consumptionHabits || ''}
                    onChange={(e) => handleFieldChange('consumer_habits.consumption_habits', e.target.value)}
                    onBlur={() => handleFieldBlur('consumer_habits.consumption_habits')}
                    placeholder="How do they consume products/media/food..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
                  />
                </div>

                {/* Decision Style */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Decision Style {savingIndicator('consumer_habits.decision_style')}
                  </label>
                  <ToggleButtons
                    options={['Impulsive', 'Thoughtful', 'Peer-influenced', 'Independent']}
                    value={parsed.decisionStyle || ''}
                    onChange={(val) => saveField('consumer_habits.decision_style', val)}
                  />
                </div>

                {/* Brand Loyalty */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Brand Loyalty {savingIndicator('consumer_habits.brand_loyalty')}
                  </label>
                  <ToggleButtons
                    options={['Loyal', 'Flexible', 'Explorer']}
                    value={parsed.brandLoyalty || ''}
                    onChange={(val) => saveField('consumer_habits.brand_loyalty', val)}
                  />
                </div>

                {/* Favorite Brands */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Favorite Brands</label>
                  <TagInput
                    tags={parsed.favoriteBrands || []}
                    onAdd={(tag) => handleAddTag('consumer_habits.favorite_brands', tag)}
                    onRemove={(i) => handleRemoveTag('consumer_habits.favorite_brands', i)}
                    color="blue"
                    placeholder="Add a brand..."
                  />
                </div>

                {/* Social Media Platforms */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Social Media Platforms</label>
                  <TagInput
                    tags={parsed.socialMedia || []}
                    onAdd={(tag) => handleAddTag('consumer_habits.social_media_platforms', tag)}
                    onRemove={(i) => handleRemoveTag('consumer_habits.social_media_platforms', i)}
                    color="purple"
                    placeholder="Add a platform..."
                  />
                </div>

                {/* Purchase Influencers */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-2">Purchase Influencers</label>
                  <TagInput
                    tags={parsed.purchaseInfluencers || []}
                    onAdd={(tag) => handleAddTag('consumer_habits.purchase_influencers', tag)}
                    onRemove={(i) => handleRemoveTag('consumer_habits.purchase_influencers', i)}
                    color="amber"
                    placeholder="What influences their purchases..."
                  />
                </div>
              </div>
            </div>

            {/* Section 5: How They Speak */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">How They Speak</h3>

              {/* Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <RangeSlider
                  label="Confidence"
                  lowLabel="Hesitant"
                  highLabel="Assertive"
                  value={getSpeakingValue('confidence')}
                  onChange={(v) => handleSpeakingChange('confidence', v)}
                />
                <RangeSlider
                  label="Verbosity"
                  lowLabel="Brief"
                  highLabel="Talkative"
                  value={getSpeakingValue('verbosity')}
                  onChange={(v) => handleSpeakingChange('verbosity', v)}
                />
                <RangeSlider
                  label="Enthusiasm"
                  lowLabel="Reserved"
                  highLabel="Excitable"
                  value={getSpeakingValue('enthusiasm')}
                  onChange={(v) => handleSpeakingChange('enthusiasm', v)}
                />
                <RangeSlider
                  label="Formality"
                  lowLabel="Casual"
                  highLabel="Formal"
                  value={getSpeakingValue('formality')}
                  onChange={(v) => handleSpeakingChange('formality', v)}
                />
              </div>

              {/* Voice Selector Row */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {persona.voice_id && (
                      <button
                        onClick={() => handlePreviewVoice(persona.voice_id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                          previewingVoice === persona.voice_id
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-primary/10 hover:text-primary'
                        }`}
                      >
                        {previewingVoice === persona.voice_id ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        )}
                      </button>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-700">Voice</p>
                      <p className="text-xs text-gray-400">
                        {persona.voice_name || persona.voice_id || 'No voice assigned'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                    className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition"
                  >
                    {showVoiceSelector ? 'Close' : 'Change'}
                  </button>
                </div>

                {/* Inline Voice Selector */}
                {showVoiceSelector && (
                  <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-72 overflow-y-auto">
                    <p className="text-xs text-gray-500 mb-3 font-medium">Voice Library</p>
                    <div className="space-y-1.5">
                      {availableVoices.length > 0 ? (
                        availableVoices.map((voice) => {
                          const vid = voice.voice_id || voice.id
                          return (
                            <div
                              key={vid}
                              className={`flex items-center justify-between p-2.5 rounded-lg border transition cursor-pointer ${
                                persona.voice_id === vid
                                  ? 'border-primary bg-primary/5'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                              onClick={() => handleChangeVoice(vid, voice.name || voice.voice_name)}
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-900">{voice.name || voice.voice_name}</p>
                                <p className="text-xs text-gray-400">{voice.description || voice.gender || ''}</p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePreviewVoice(vid) }}
                                className={`p-1.5 rounded-full transition ${previewingVoice === vid ? 'bg-primary text-white' : 'text-gray-400 hover:text-primary hover:bg-primary/5'}`}
                              >
                                {previewingVoice === vid ? (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                )}
                              </button>
                            </div>
                          )
                        })
                      ) : null}

                      <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-200 font-medium">Default Voices</p>
                      {DEFAULT_VOICES.map((voice) => (
                        <div
                          key={voice.voice_id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border transition cursor-pointer ${
                            persona.voice_id === voice.voice_id
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                          onClick={() => handleChangeVoice(voice.voice_id, voice.name)}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">{voice.name}</p>
                            <p className="text-xs text-gray-400">{voice.description}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePreviewVoice(voice.voice_id) }}
                            className={`p-1.5 rounded-full transition ${previewingVoice === voice.voice_id ? 'bg-primary text-white' : 'text-gray-400 hover:text-primary hover:bg-primary/5'}`}
                          >
                            {previewingVoice === voice.voice_id ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dictionaries Row */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Dictionaries</p>
                    <p className="text-xs text-gray-400">Assigned phrase collections for speech style</p>
                  </div>
                  <button
                    onClick={() => setShowDictPicker(!showDictPicker)}
                    className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition"
                  >
                    {showDictPicker ? 'Close' : 'Add'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {dictionaries.length > 0 ? (
                    dictionaries.map((dict) => {
                      const dictId = dict.id || dict._id
                      return (
                        <span
                          key={dictId}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                        >
                          {dict.name}
                          <button
                            onClick={() => handleRemoveDictionary(dictId)}
                            className="ml-0.5 hover:opacity-70 transition"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      )
                    })
                  ) : (
                    <p className="text-xs text-gray-400 italic">No dictionaries assigned</p>
                  )}
                </div>

                {showDictPicker && (
                  <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                    {allDictionaries.filter(d => !(persona.dictionary_ids || []).includes(d.id || d._id)).length > 0 ? (
                      <div className="space-y-1">
                        {allDictionaries
                          .filter(d => !(persona.dictionary_ids || []).includes(d.id || d._id))
                          .map((dict) => (
                            <button
                              key={dict.id || dict._id}
                              onClick={() => handleAssignDictionary(dict)}
                              className="w-full text-left p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition"
                            >
                              <p className="text-sm font-medium text-gray-900">{dict.name}</p>
                              {dict.description && <p className="text-xs text-gray-400">{dict.description}</p>}
                            </button>
                          ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">No more dictionaries available</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* TAB 2: LIFE & STORY */}
        {/* ============================================ */}
        {activeTab === 'life' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Life & Story</h2>
              <button
                onClick={handleGenerateBackstory}
                disabled={generating === 'backstory'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm font-medium text-gray-700 rounded-xl hover:border-primary hover:text-primary transition disabled:opacity-50"
              >
                {generating === 'backstory' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Backstory
                  </>
                )}
              </button>
            </div>

            {/* A Day in the Life */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                A Day in the Life {savingIndicator('day_in_life')}
              </label>
              <textarea
                rows={5}
                value={getFieldValue('day_in_life')}
                onChange={(e) => handleFieldChange('day_in_life', e.target.value)}
                onBlur={() => handleFieldBlur('day_in_life')}
                placeholder="Describe a typical day for this persona..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
              />
            </div>

            {/* Backstory */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Backstory {savingIndicator('backstory')}
              </label>
              <textarea
                rows={6}
                value={getFieldValue('backstory')}
                onChange={(e) => handleFieldChange('backstory', e.target.value)}
                onBlur={() => handleFieldBlur('backstory')}
                placeholder="Their life story, background, and experiences..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
              />
            </div>

            {/* 2x2 Grid: Family, School, Friendships, Home */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'family', label: 'Family', placeholder: 'Family relationships and dynamics...' },
                { key: 'school', label: 'School', placeholder: 'Education, school experiences...' },
                { key: 'friendships', label: 'Friendships', placeholder: 'Friend groups, social circles...' },
                { key: 'home', label: 'Home', placeholder: 'Living situation, home environment...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="rounded-2xl bg-white border border-gray-200 p-5">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    {label} {savingIndicator(key)}
                  </label>
                  <textarea
                    rows={4}
                    value={getFieldValue(key)}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    onBlur={() => handleFieldBlur(key)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
                  />
                </div>
              ))}
            </div>

            {/* Dreams & Aspirations + Challenges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Dreams & Aspirations {savingIndicator('dreams_aspirations')}
                </label>
                <textarea
                  rows={4}
                  value={getFieldValue('dreams_aspirations')}
                  onChange={(e) => handleFieldChange('dreams_aspirations', e.target.value)}
                  onBlur={() => handleFieldBlur('dreams_aspirations')}
                  placeholder="What do they aspire to, dream about..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
                />
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Challenges {savingIndicator('challenges')}
                </label>
                <textarea
                  rows={4}
                  value={getFieldValue('challenges')}
                  onChange={(e) => handleFieldChange('challenges', e.target.value)}
                  onBlur={() => handleFieldBlur('challenges')}
                  placeholder="Struggles, obstacles, difficulties..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
                />
              </div>
            </div>

            {/* Formative Events */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Formative Events</label>
              {(Array.isArray(persona.formative_events) ? persona.formative_events : []).length > 0 ? (
                <ul className="space-y-1.5 mb-3">
                  {(Array.isArray(persona.formative_events) ? persona.formative_events : []).map((event, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
                      {event}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic mb-3">No formative events defined</p>
              )}
              <CollapsibleTextarea
                label="Edit formative events (one per line)"
                value={getFieldValue('formative_events_text') !== '' ? getFieldValue('formative_events_text') : (Array.isArray(persona.formative_events) ? persona.formative_events.join('\n') : '')}
                onChange={(v) => handleFieldChange('formative_events_text', v)}
                onBlur={async () => {
                  const raw = editedFields['formative_events_text']
                  if (raw === undefined) return
                  const items = raw.split('\n').map(s => s.trim()).filter(Boolean)
                  setSavingField('formative_events')
                  try {
                    await personasApi.update(id, { formative_events: items })
                    const res = await personasApi.get(id)
                    setPersona(res.data)
                    setEditedFields(prev => { const n = { ...prev }; delete n['formative_events_text']; return n })
                  } finally {
                    setSavingField(null)
                  }
                }}
                placeholder="One event per line..."
                rows={5}
                saving={savingField === 'formative_events'}
              />
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* TAB 3: WORLDVIEW */}
        {/* ============================================ */}
        {activeTab === 'worldview' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Worldview</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Things They Know */}
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Things They Know</h3>
                </div>
                {getWorldviewItems('things_they_know').length > 0 ? (
                  <ul className="space-y-1.5 mb-3">
                    {getWorldviewItems('things_they_know').map((item, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5 flex-shrink-0">&#8226;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic mb-3">Not defined yet</p>
                )}
                <CollapsibleTextarea
                  label="Edit (separate items with blank lines)"
                  value={getFieldValue('things_they_know_text') !== '' ? getFieldValue('things_they_know_text') : getWorldviewText('things_they_know')}
                  onChange={(v) => handleFieldChange('things_they_know_text', v)}
                  onBlur={async () => {
                    const raw = editedFields['things_they_know_text']
                    if (raw === undefined) return
                    const items = raw.split('\n\n').map(s => s.trim()).filter(Boolean)
                    setSavingField('things_they_know')
                    try {
                      await personasApi.update(id, { things_they_know: items })
                      const res = await personasApi.get(id)
                      setPersona(res.data)
                      setEditedFields(prev => { const n = { ...prev }; delete n['things_they_know_text']; return n })
                    } finally {
                      setSavingField(null)
                    }
                  }}
                  placeholder="Separate items with blank lines..."
                  rows={5}
                  saving={savingField === 'things_they_know'}
                />
              </div>

              {/* Things They Don't Know */}
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Things They Don't Know</h3>
                </div>
                {getWorldviewItems('things_they_dont_know').length > 0 ? (
                  <ul className="space-y-1.5 mb-3">
                    {getWorldviewItems('things_they_dont_know').map((item, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0">&#8226;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic mb-3">Not defined yet</p>
                )}
                <CollapsibleTextarea
                  label="Edit (separate items with blank lines)"
                  value={getFieldValue('things_they_dont_know_text') !== '' ? getFieldValue('things_they_dont_know_text') : getWorldviewText('things_they_dont_know')}
                  onChange={(v) => handleFieldChange('things_they_dont_know_text', v)}
                  onBlur={async () => {
                    const raw = editedFields['things_they_dont_know_text']
                    if (raw === undefined) return
                    const items = raw.split('\n\n').map(s => s.trim()).filter(Boolean)
                    setSavingField('things_they_dont_know')
                    try {
                      await personasApi.update(id, { things_they_dont_know: items })
                      const res = await personasApi.get(id)
                      setPersona(res.data)
                      setEditedFields(prev => { const n = { ...prev }; delete n['things_they_dont_know_text']; return n })
                    } finally {
                      setSavingField(null)
                    }
                  }}
                  placeholder="Separate items with blank lines..."
                  rows={5}
                  saving={savingField === 'things_they_dont_know'}
                />
              </div>

              {/* Beliefs & Opinions */}
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Beliefs & Opinions</h3>
                </div>
                {getWorldviewItems('beliefs_opinions').length > 0 ? (
                  <ul className="space-y-1.5 mb-3">
                    {getWorldviewItems('beliefs_opinions').map((item, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5 flex-shrink-0">&#8226;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic mb-3">Not defined yet</p>
                )}
                <CollapsibleTextarea
                  label="Edit (separate items with blank lines)"
                  value={getFieldValue('beliefs_opinions_text') !== '' ? getFieldValue('beliefs_opinions_text') : getWorldviewText('beliefs_opinions')}
                  onChange={(v) => handleFieldChange('beliefs_opinions_text', v)}
                  onBlur={async () => {
                    const raw = editedFields['beliefs_opinions_text']
                    if (raw === undefined) return
                    const items = raw.split('\n\n').map(s => s.trim()).filter(Boolean)
                    setSavingField('beliefs_opinions')
                    try {
                      await personasApi.update(id, { beliefs_opinions: items })
                      const res = await personasApi.get(id)
                      setPersona(res.data)
                      setEditedFields(prev => { const n = { ...prev }; delete n['beliefs_opinions_text']; return n })
                    } finally {
                      setSavingField(null)
                    }
                  }}
                  placeholder="Separate items with blank lines..."
                  rows={5}
                  saving={savingField === 'beliefs_opinions'}
                />
              </div>

              {/* Misconceptions */}
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Misconceptions</h3>
                </div>
                {getWorldviewItems('misconceptions').length > 0 ? (
                  <ul className="space-y-1.5 mb-3">
                    {getWorldviewItems('misconceptions').map((item, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-red-500 mt-0.5 flex-shrink-0">&#8226;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic mb-3">Not defined yet</p>
                )}
                <CollapsibleTextarea
                  label="Edit (separate items with blank lines)"
                  value={getFieldValue('misconceptions_text') !== '' ? getFieldValue('misconceptions_text') : getWorldviewText('misconceptions')}
                  onChange={(v) => handleFieldChange('misconceptions_text', v)}
                  onBlur={async () => {
                    const raw = editedFields['misconceptions_text']
                    if (raw === undefined) return
                    const items = raw.split('\n\n').map(s => s.trim()).filter(Boolean)
                    setSavingField('misconceptions')
                    try {
                      await personasApi.update(id, { misconceptions: items })
                      const res = await personasApi.get(id)
                      setPersona(res.data)
                      setEditedFields(prev => { const n = { ...prev }; delete n['misconceptions_text']; return n })
                    } finally {
                      setSavingField(null)
                    }
                  }}
                  placeholder="Separate items with blank lines..."
                  rows={5}
                  saving={savingField === 'misconceptions'}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
