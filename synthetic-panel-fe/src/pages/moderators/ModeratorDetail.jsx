import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { moderatorsApi, voiceApi } from '../../services/api'

// ============================================
// Constants
// ============================================
const MODERATOR_TYPES = [
  { value: 'professional', label: 'The Professional', description: 'Structured and methodical. Keeps sessions on track.' },
  { value: 'empath', label: 'The Empath', description: 'Warm and encouraging. Draws out shy participants.' },
  { value: 'challenger', label: 'The Challenger', description: 'Probes deeper. Pushes past surface answers.' },
  { value: 'neutral', label: 'The Neutral', description: 'Minimal personality. Lets group self-direct.' },
  { value: 'energizer', label: 'The Energizer', description: 'Upbeat and dynamic. Keeps momentum high.' },
  { value: 'expert', label: 'The Expert', description: 'Domain knowledge. Probes technical areas.' },
]

const DEFAULT_PERSONALITIES = {
  professional: { warmth: 4, pace: 6, formality: 7, humor: 3 },
  empath: { warmth: 9, pace: 4, formality: 4, humor: 5 },
  challenger: { warmth: 4, pace: 5, formality: 6, humor: 3 },
  neutral: { warmth: 5, pace: 5, formality: 5, humor: 2 },
  energizer: { warmth: 7, pace: 8, formality: 3, humor: 7 },
  expert: { warmth: 5, pace: 5, formality: 8, humor: 2 },
}

const DEFAULT_BIOS = {
  professional: 'Structured and methodical. Keeps sessions on track and ensures all questions are covered efficiently.',
  empath: 'Warm and encouraging. Creates a safe space for sharing and excels at drawing out shy participants.',
  challenger: 'Probes deeper on answers. Pushes past surface responses to uncover real opinions and motivations.',
  neutral: 'Minimal personality interference. Lets the group self-direct while maintaining basic facilitation.',
  energizer: 'Upbeat and dynamic. Keeps momentum high and energy flowing, especially in longer sessions.',
  expert: 'Domain knowledgeable. Can probe technical areas and speak the language of specialized topics.',
}

const TYPE_COLORS = {
  professional: { bg: 'bg-blue-100', text: 'text-blue-700', chip: 'border-blue-400 bg-blue-50 text-blue-700', active: 'border-blue-500 bg-blue-100 text-blue-800 ring-2 ring-blue-300' },
  empath: { bg: 'bg-pink-100', text: 'text-pink-700', chip: 'border-pink-400 bg-pink-50 text-pink-700', active: 'border-pink-500 bg-pink-100 text-pink-800 ring-2 ring-pink-300' },
  challenger: { bg: 'bg-orange-100', text: 'text-orange-700', chip: 'border-orange-400 bg-orange-50 text-orange-700', active: 'border-orange-500 bg-orange-100 text-orange-800 ring-2 ring-orange-300' },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-600', chip: 'border-gray-400 bg-gray-50 text-gray-600', active: 'border-gray-500 bg-gray-200 text-gray-800 ring-2 ring-gray-300' },
  energizer: { bg: 'bg-yellow-100', text: 'text-yellow-700', chip: 'border-yellow-400 bg-yellow-50 text-yellow-700', active: 'border-yellow-500 bg-yellow-100 text-yellow-800 ring-2 ring-yellow-300' },
  expert: { bg: 'bg-purple-100', text: 'text-purple-700', chip: 'border-purple-400 bg-purple-50 text-purple-700', active: 'border-purple-500 bg-purple-100 text-purple-800 ring-2 ring-purple-300' },
}

const DEFAULT_VOICES = [
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm female' },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Energetic female' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Soft female' },
  { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Conversational male' },
  { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Deep male' },
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Neutral male' },
]

const SLIDER_CONFIG = [
  { key: 'warmth', label: 'Warmth', low: 'Reserved', high: 'Warm', color: 'from-blue-400 to-orange-400' },
  { key: 'pace', label: 'Pace', low: 'Slow', high: 'Fast', color: 'from-green-400 to-red-400' },
  { key: 'formality', label: 'Formality', low: 'Casual', high: 'Formal', color: 'from-yellow-400 to-purple-400' },
  { key: 'humor', label: 'Humor', low: 'Serious', high: 'Playful', color: 'from-gray-400 to-pink-400' },
]

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

function getTypeColor(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.neutral
}

// ============================================
// Main Component
// ============================================
export default function ModeratorDetail() {
  const { id } = useParams()

  const [moderator, setModerator] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Inline editing state
  const [editedFields, setEditedFields] = useState({})
  const [savingField, setSavingField] = useState(null)

  // Voice state
  const [showVoiceSelector, setShowVoiceSelector] = useState(false)
  const [availableVoices, setAvailableVoices] = useState([])
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [playingVoice, setPlayingVoice] = useState(null)
  const audioRef = useRef(new Audio())

  // Avatar state
  const [generatingAvatar, setGeneratingAvatar] = useState(false)
  const [avatarPrompt, setAvatarPrompt] = useState('')

  // ------------------------------------------
  // Data fetching
  // ------------------------------------------
  const fetchModerator = useCallback(async () => {
    try {
      const response = await moderatorsApi.get(id)
      setModerator(response.data)
    } catch (err) {
      setError('Failed to load moderator')
      console.error('Failed to fetch moderator:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchModerator()
  }, [fetchModerator])

  // ------------------------------------------
  // Inline field editing helpers
  // ------------------------------------------
  const getFieldValue = useCallback((field) => {
    if (editedFields[field] !== undefined) return editedFields[field]
    return moderator?.[field] ?? ''
  }, [editedFields, moderator])

  const handleFieldChange = useCallback((field, value) => {
    setEditedFields(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleFieldBlur = useCallback(async (field) => {
    const value = editedFields[field]
    if (value === undefined) return

    const original = moderator?.[field]
    if (value === original) {
      setEditedFields(prev => { const n = { ...prev }; delete n[field]; return n })
      return
    }

    setSavingField(field)
    try {
      await moderatorsApi.update(id, { [field]: value })
      const res = await moderatorsApi.get(id)
      setModerator(res.data)
      setEditedFields(prev => { const n = { ...prev }; delete n[field]; return n })
    } catch (err) {
      console.error(`Failed to save ${field}:`, err)
    } finally {
      setSavingField(null)
    }
  }, [editedFields, moderator, id])

  // Direct save (no blur needed, e.g. selects, toggles)
  const saveField = useCallback(async (field, value) => {
    setSavingField(field)
    try {
      await moderatorsApi.update(id, { [field]: value })
      const res = await moderatorsApi.get(id)
      setModerator(res.data)
    } catch (err) {
      console.error(`Failed to save ${field}:`, err)
    } finally {
      setSavingField(null)
    }
  }, [id])

  // ------------------------------------------
  // Personality helpers
  // ------------------------------------------
  const getPersonalityValue = useCallback((key) => {
    if (editedFields[`personality.${key}`] !== undefined) return editedFields[`personality.${key}`]
    return moderator?.personality?.[key] ?? 5
  }, [editedFields, moderator])

  const handlePersonalityChange = useCallback(async (key, value) => {
    const updated = { ...(moderator?.personality || {}), [key]: value }
    setSavingField(`personality.${key}`)
    try {
      await moderatorsApi.update(id, { personality: updated })
      const res = await moderatorsApi.get(id)
      setModerator(res.data)
    } catch (err) {
      console.error('Failed to save personality:', err)
    } finally {
      setSavingField(null)
    }
  }, [id, moderator?.personality])

  // ------------------------------------------
  // Phrases helpers
  // ------------------------------------------
  const getPhrasesValue = useCallback((key) => {
    if (editedFields[`phrases.${key}`] !== undefined) return editedFields[`phrases.${key}`]
    if (key === 'transitions') {
      const raw = moderator?.phrases?.transitions
      return Array.isArray(raw) ? raw.join('\n') : ''
    }
    return moderator?.phrases?.[key] ?? ''
  }, [editedFields, moderator])

  const handlePhrasesChange = useCallback((key, value) => {
    setEditedFields(prev => ({ ...prev, [`phrases.${key}`]: value }))
  }, [])

  const handlePhrasesBlur = useCallback(async (key) => {
    const value = editedFields[`phrases.${key}`]
    if (value === undefined) return

    const currentPhrases = moderator?.phrases || { opening: '', transitions: [], closing: '' }
    let updated
    if (key === 'transitions') {
      updated = { ...currentPhrases, transitions: value.split('\n').filter(Boolean) }
    } else {
      updated = { ...currentPhrases, [key]: value }
    }

    setSavingField(`phrases.${key}`)
    try {
      await moderatorsApi.update(id, { phrases: updated })
      const res = await moderatorsApi.get(id)
      setModerator(res.data)
      setEditedFields(prev => { const n = { ...prev }; delete n[`phrases.${key}`]; return n })
    } catch (err) {
      console.error('Failed to save phrases:', err)
    } finally {
      setSavingField(null)
    }
  }, [editedFields, moderator, id])

  // ------------------------------------------
  // Type change (also updates personality + bio)
  // ------------------------------------------
  const handleTypeChange = useCallback(async (newType) => {
    setSavingField('type')
    try {
      await moderatorsApi.update(id, {
        type: newType,
        moderation_style: newType,
        personality: DEFAULT_PERSONALITIES[newType],
        bio: DEFAULT_BIOS[newType],
      })
      const res = await moderatorsApi.get(id)
      setModerator(res.data)
    } catch (err) {
      console.error('Failed to save type:', err)
    } finally {
      setSavingField(null)
    }
  }, [id])

  // ------------------------------------------
  // Default toggle
  // ------------------------------------------
  const handleSetDefault = useCallback(async () => {
    try {
      await moderatorsApi.setDefault(id)
      const res = await moderatorsApi.get(id)
      setModerator(res.data)
    } catch (err) {
      console.error('Failed to set default:', err)
    }
  }, [id])

  // ------------------------------------------
  // Avatar
  // ------------------------------------------
  const handleGenerateAvatar = useCallback(async () => {
    setGeneratingAvatar(true)
    try {
      await moderatorsApi.generateAvatar(id, { custom_prompt: avatarPrompt || undefined })
      const res = await moderatorsApi.get(id)
      setModerator(res.data)
      setAvatarPrompt('')
    } catch (err) {
      console.error('Failed to generate avatar:', err)
      setError('Failed to generate avatar')
    } finally {
      setGeneratingAvatar(false)
    }
  }, [id, avatarPrompt])

  // ------------------------------------------
  // Voice
  // ------------------------------------------
  const fetchVoices = useCallback(async () => {
    if (availableVoices.length > 0) return
    setLoadingVoices(true)
    try {
      const res = await voiceApi.listLibrary()
      const voices = res.data?.voices || res.data || []
      setAvailableVoices(voices)
    } catch (err) {
      console.error('Failed to load voices:', err)
      setAvailableVoices([])
    } finally {
      setLoadingVoices(false)
    }
  }, [availableVoices.length])

  const handleVoiceSelect = useCallback(async (voice) => {
    setSavingField('voice')
    try {
      await moderatorsApi.update(id, {
        voice_id: voice.voice_id || voice.elevenlabs_voice_id,
        voice_name: voice.name,
      })
      const res = await moderatorsApi.get(id)
      setModerator(res.data)
      setShowVoiceSelector(false)
    } catch (err) {
      console.error('Failed to save voice:', err)
    } finally {
      setSavingField(null)
    }
  }, [id])

  const previewVoice = useCallback(async (voiceId, previewUrl) => {
    if (playingVoice === voiceId) {
      audioRef.current?.pause()
      setPlayingVoice(null)
      return
    }

    audioRef.current?.pause()
    setPlayingVoice(voiceId)

    try {
      if (previewUrl) {
        const audio = new Audio(previewUrl)
        audioRef.current = audio
        audio.onended = () => setPlayingVoice(null)
        audio.onerror = () => setPlayingVoice(null)
        await audio.play()
      } else {
        setPlayingVoice(null)
      }
    } catch (err) {
      console.error('Error playing voice:', err)
      setPlayingVoice(null)
    }
  }, [playingVoice])

  const openVoiceSelector = useCallback(() => {
    setShowVoiceSelector(true)
    fetchVoices()
  }, [fetchVoices])

  // ------------------------------------------
  // Render
  // ------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    )
  }

  if (!moderator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Moderator not found</h2>
          <Link to="/moderators" className="text-primary hover:underline">Back to Moderators</Link>
        </div>
      </div>
    )
  }

  const currentType = moderator.moderation_style || moderator.type || 'neutral'
  const typeColor = getTypeColor(currentType)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back link */}
        <Link
          to="/moderators"
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition mb-6 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Moderators
        </Link>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ============================================ */}
        {/* HEADER CARD — Avatar + Name + Type badge     */}
        {/* ============================================ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex flex-col md:flex-row">
            {/* Avatar */}
            <div className="md:w-80 p-6 flex flex-col items-center justify-center bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200">
              <div className="relative group">
                {moderator.avatar_url ? (
                  <img
                    src={moderator.avatar_url}
                    alt={moderator.name}
                    className="w-32 h-32 rounded-full object-cover object-top shadow-lg"
                  />
                ) : (
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center bg-gradient-to-br ${getGradient(moderator.name)}`}>
                    <span className="text-4xl font-bold text-white/90">
                      {moderator.name ? moderator.name.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => handleGenerateAvatar()}
                  disabled={generatingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
                >
                  {generatingAvatar ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-white text-xs font-medium">
                      {moderator.avatar_url ? 'Regenerate' : 'Generate'}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Name + badge + default toggle */}
            <div className="flex-1 p-6">
              <input
                type="text"
                value={getFieldValue('name')}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                onBlur={() => handleFieldBlur('name')}
                placeholder="Moderator Name"
                className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 w-full text-gray-900 placeholder-gray-300 mb-2"
              />
              {savingField === 'name' && <span className="text-xs text-primary animate-pulse">saving...</span>}

              <p className="text-gray-500 text-sm leading-relaxed mb-4 italic">
                {moderator.bio || 'No bio yet...'}
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Type badge */}
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${typeColor.bg} ${typeColor.text}`}>
                  {MODERATOR_TYPES.find(t => t.value === currentType)?.label || currentType}
                </span>

                {/* Default toggle */}
                <button
                  onClick={handleSetDefault}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    moderator.is_default
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {moderator.is_default ? 'Default Moderator' : 'Set as Default'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* BASIC INFO CARD                              */}
        {/* ============================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Info</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={getFieldValue('name')}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                onBlur={() => handleFieldBlur('name')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={moderator.gender || 'female'}
                onChange={(e) => saveField('gender', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
              {savingField === 'gender' && <span className="text-xs text-primary animate-pulse">saving...</span>}
            </div>
          </div>

          {/* Type selector chips */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {MODERATOR_TYPES.map((t) => {
                const tc = TYPE_COLORS[t.value] || TYPE_COLORS.neutral
                const isActive = currentType === t.value
                return (
                  <button
                    key={t.value}
                    onClick={() => handleTypeChange(t.value)}
                    disabled={savingField === 'type'}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      isActive ? tc.active : tc.chip + ' hover:opacity-80'
                    }`}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            {savingField === 'type' && <span className="text-xs text-primary animate-pulse mt-1 inline-block">saving...</span>}
            {/* Selected type description */}
            <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg">
              {MODERATOR_TYPES.find(t => t.value === currentType)?.description}
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio
              {savingField === 'bio' && <span className="text-xs text-primary animate-pulse ml-2">saving...</span>}
            </label>
            <textarea
              value={getFieldValue('bio')}
              onChange={(e) => handleFieldChange('bio', e.target.value)}
              onBlur={() => handleFieldBlur('bio')}
              rows={3}
              placeholder="Describe the moderator's style..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
              style={{ minHeight: '60px' }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
            />
          </div>
        </div>

        {/* ============================================ */}
        {/* PERSONALITY SLIDERS CARD                     */}
        {/* ============================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Personality</h2>

          <div className="space-y-5">
            {SLIDER_CONFIG.map((slider) => {
              const value = getPersonalityValue(slider.key)
              return (
                <div key={slider.key}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">{slider.label}</span>
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full tabular-nums">
                      {value}/10
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-14">{slider.low}</span>
                    <div className="flex-1 relative">
                      {/* Background track */}
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${slider.color} rounded-full transition-all duration-300 ease-out`}
                          style={{ width: `${(value / 10) * 100}%` }}
                        />
                      </div>
                      {/* Invisible range input */}
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={value}
                        onChange={(e) => handlePersonalityChange(slider.key, parseInt(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                      />
                      {/* Thumb indicator */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md border-2 border-primary transition-all duration-300 ease-out pointer-events-none"
                        style={{ left: `calc(${(value / 10) * 100}% - 8px)` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-14 text-right">{slider.high}</span>
                  </div>
                  {savingField === `personality.${slider.key}` && (
                    <span className="text-xs text-primary animate-pulse mt-1 inline-block">saving...</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ============================================ */}
        {/* VOICE SECTION                                */}
        {/* ============================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Voice
          </h2>

          {/* Current voice display */}
          <div className="flex items-center gap-3 mb-4">
            {/* Play button */}
            <button
              onClick={() => moderator.voice_id && previewVoice(moderator.voice_id, moderator.voice_preview_url)}
              disabled={!moderator.voice_id}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition flex-shrink-0 ${
                playingVoice === moderator.voice_id
                  ? 'bg-green-500 text-white'
                  : moderator.voice_id
                  ? 'bg-green-50 text-green-600 hover:bg-green-100'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {playingVoice === moderator.voice_id ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm ${moderator.voice_id ? 'text-gray-900' : 'text-gray-400'}`}>
                {moderator.voice_name || 'No voice selected'}
              </p>
            </div>

            <button
              onClick={openVoiceSelector}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-sm text-gray-700 transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
              Change Voice
            </button>
          </div>

          {/* Inline voice selector */}
          {showVoiceSelector && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Select Voice</span>
                <button
                  onClick={() => setShowVoiceSelector(false)}
                  className="p-1 hover:bg-gray-200 rounded-lg transition text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                {loadingVoices ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : (
                  <>
                    {/* Library voices */}
                    {availableVoices.map((voice) => {
                      const vid = voice.voice_id || voice.elevenlabs_voice_id
                      const isSelected = moderator.voice_id === vid
                      return (
                        <div
                          key={vid}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer ${
                            isSelected
                              ? 'bg-primary/5 border-primary/30'
                              : 'bg-white border-gray-100 hover:border-gray-300'
                          }`}
                          onClick={() => handleVoiceSelect({ voice_id: vid, name: voice.name })}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              previewVoice(vid, voice.preview_url)
                            }}
                            disabled={!voice.preview_url}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition flex-shrink-0 ${
                              playingVoice === vid
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {playingVoice === vid ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              </svg>
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                              {voice.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{voice.description || voice.gender || ''}</p>
                          </div>

                          {isSelected ? (
                            <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex-shrink-0" />
                          )}
                        </div>
                      )
                    })}

                    {/* Default ElevenLabs voices */}
                    {DEFAULT_VOICES.map((voice) => {
                      const isSelected = moderator.voice_id === voice.voice_id
                      return (
                        <div
                          key={voice.voice_id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer ${
                            isSelected
                              ? 'bg-primary/5 border-primary/30'
                              : 'bg-white border-gray-100 hover:border-gray-300'
                          }`}
                          onClick={() => handleVoiceSelect(voice)}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-400 flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                              {voice.name}
                            </p>
                            <p className="text-xs text-gray-500">{voice.description}</p>
                          </div>
                          {isSelected ? (
                            <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex-shrink-0" />
                          )}
                        </div>
                      )
                    })}

                    {availableVoices.length === 0 && !loadingVoices && (
                      <p className="text-center text-gray-400 text-sm py-6">No library voices found. Default voices shown above.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {savingField === 'voice' && <span className="text-xs text-primary animate-pulse mt-2 inline-block">saving...</span>}
        </div>

        {/* ============================================ */}
        {/* FACILITATION PHRASES CARD                    */}
        {/* ============================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Facilitation Phrases</h2>

          <div className="space-y-4">
            {/* Opening */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opening Phrase
                {savingField === 'phrases.opening' && <span className="text-xs text-primary animate-pulse ml-2">saving...</span>}
              </label>
              <input
                type="text"
                value={getPhrasesValue('opening')}
                onChange={(e) => handlePhrasesChange('opening', e.target.value)}
                onBlur={() => handlePhrasesBlur('opening')}
                placeholder="e.g. Thanks for joining today..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>

            {/* Transitions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transition Phrases <span className="text-gray-400 font-normal">(one per line)</span>
                {savingField === 'phrases.transitions' && <span className="text-xs text-primary animate-pulse ml-2">saving...</span>}
              </label>
              <textarea
                value={getPhrasesValue('transitions')}
                onChange={(e) => handlePhrasesChange('transitions', e.target.value)}
                onBlur={() => handlePhrasesBlur('transitions')}
                rows={4}
                placeholder="That's a great point. Let's explore that further.&#10;Interesting perspective. Does anyone else have thoughts?"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
              />
            </div>

            {/* Closing */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Closing Phrase
                {savingField === 'phrases.closing' && <span className="text-xs text-primary animate-pulse ml-2">saving...</span>}
              </label>
              <input
                type="text"
                value={getPhrasesValue('closing')}
                onChange={(e) => handlePhrasesChange('closing', e.target.value)}
                onBlur={() => handlePhrasesBlur('closing')}
                placeholder="e.g. Thank you all for sharing today..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* AVATAR CARD                                  */}
        {/* ============================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Avatar</h2>

          <div className="flex flex-col items-center">
            {/* Large avatar display */}
            {moderator.avatar_url ? (
              <img
                src={moderator.avatar_url}
                alt={moderator.name}
                className="w-48 h-48 rounded-2xl object-cover object-top shadow-lg mb-4"
              />
            ) : (
              <div className={`w-48 h-48 rounded-2xl flex items-center justify-center bg-gradient-to-br ${getGradient(moderator.name)} mb-4`}>
                <span className="text-6xl font-bold text-white/90">
                  {moderator.name ? moderator.name.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
            )}

            {/* Custom prompt */}
            <div className="w-full max-w-md mb-3">
              <input
                type="text"
                value={avatarPrompt}
                onChange={(e) => setAvatarPrompt(e.target.value)}
                placeholder="Custom prompt (optional)..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>

            <button
              onClick={handleGenerateAvatar}
              disabled={generatingAvatar}
              className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generatingAvatar ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {moderator.avatar_url ? 'Regenerate Avatar' : 'Generate Avatar'}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
