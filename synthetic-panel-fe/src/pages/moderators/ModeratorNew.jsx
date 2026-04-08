import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { moderatorsApi, voiceApi } from '../../services/api'

const MODERATOR_TYPES = [
  { value: 'professional', label: 'The Professional', description: 'Structured and methodical. Keeps sessions on track.' },
  { value: 'empath', label: 'The Empath', description: 'Warm and encouraging. Draws out shy participants.' },
  { value: 'challenger', label: 'The Challenger', description: 'Probes deeper. Pushes past surface answers.' },
  { value: 'neutral', label: 'The Neutral', description: 'Minimal personality. Lets group self-direct.' },
  { value: 'energizer', label: 'The Energizer', description: 'Upbeat and dynamic. Keeps momentum high.' },
  { value: 'expert', label: 'The Expert', description: 'Domain knowledge. Probes technical areas.' },
]

const DEFAULT_PERSONALITIES = {
  professional: { warmth: 5, pace: 5, formality: 8, humor: 3 },
  empath: { warmth: 9, pace: 4, formality: 4, humor: 5 },
  challenger: { warmth: 4, pace: 7, formality: 6, humor: 4 },
  neutral: { warmth: 5, pace: 5, formality: 5, humor: 3 },
  energizer: { warmth: 7, pace: 8, formality: 3, humor: 8 },
  expert: { warmth: 5, pace: 5, formality: 7, humor: 3 },
}

const DEFAULT_BIOS = {
  professional: 'A seasoned research professional who keeps sessions structured, on track, and ensures all questions are covered efficiently.',
  empath: 'A warm, nurturing facilitator who creates a safe space for sharing and excels at drawing out shy participants.',
  challenger: 'A direct, probing moderator who pushes past surface responses to uncover real opinions and motivations.',
  neutral: 'A balanced, impartial moderator who lets the group self-direct while maintaining basic facilitation.',
  energizer: 'A dynamic, enthusiastic facilitator who keeps momentum high and energy flowing, especially in longer sessions.',
  expert: 'A knowledgeable domain expert who can probe technical areas and speak the language of specialized topics.',
}

const TYPE_CHIP_COLORS = {
  professional: { active: 'border-blue-500 bg-blue-50 text-blue-700', inactive: 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700' },
  empath: { active: 'border-pink-500 bg-pink-50 text-pink-700', inactive: 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700' },
  challenger: { active: 'border-orange-500 bg-orange-50 text-orange-700', inactive: 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700' },
  neutral: { active: 'border-gray-500 bg-gray-100 text-gray-700', inactive: 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700' },
  energizer: { active: 'border-yellow-500 bg-yellow-50 text-yellow-700', inactive: 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700' },
  expert: { active: 'border-purple-500 bg-purple-50 text-purple-700', inactive: 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700' },
}

const PERSONALITY_SLIDERS = [
  { key: 'warmth', label: 'Warmth', low: 'Reserved', high: 'Warm', color: 'from-blue-400 to-orange-400' },
  { key: 'pace', label: 'Pace', low: 'Slow', high: 'Fast', color: 'from-green-400 to-red-400' },
  { key: 'formality', label: 'Formality', low: 'Casual', high: 'Formal', color: 'from-yellow-400 to-purple-400' },
  { key: 'humor', label: 'Humor', low: 'Serious', high: 'Playful', color: 'from-gray-400 to-pink-400' },
]

function ModeratorNew() {
  const navigate = useNavigate()
  const audioRef = useRef(null)

  const [saving, setSaving] = useState(false)
  const [generatingAvatar, setGeneratingAvatar] = useState(false)
  const [error, setError] = useState(null)
  const [playingVoice, setPlayingVoice] = useState(null)
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [availableVoices, setAvailableVoices] = useState([])

  const [name, setName] = useState('')
  const [type, setType] = useState('professional')
  const [gender, setGender] = useState('female')
  const [bio, setBio] = useState(DEFAULT_BIOS.professional)
  const [personality, setPersonality] = useState(DEFAULT_PERSONALITIES.professional)
  const [voiceId, setVoiceId] = useState('')
  const [voiceName, setVoiceName] = useState('')
  const [phrases, setPhrases] = useState({
    opening: "Thanks for joining today. I'm excited to hear your thoughts.",
    transitions: [
      "That's a great point. Let's explore that further.",
      "Interesting perspective. Does anyone else have thoughts on this?",
      "Let's move on to our next topic.",
    ],
    closing: "Thank you all for sharing today. Your insights have been really valuable.",
  })

  function handleTypeChange(newType) {
    setType(newType)
    setPersonality(DEFAULT_PERSONALITIES[newType])
    setBio(DEFAULT_BIOS[newType])
  }

  function handleVoiceSelect(voice) {
    setVoiceId(voice.voice_id)
    setVoiceName(voice.name)
    setShowVoiceModal(false)
  }

  async function fetchVoicesForModal() {
    if (availableVoices.length > 0) return

    setLoadingVoices(true)
    try {
      const res = await voiceApi.listLibrary()
      const voices = (res.data.voices || res.data || []).map((voice) => ({
        voice_id: voice.elevenlabs_voice_id || voice.voice_id || voice.id,
        name: voice.name,
        description: voice.description || `${voice.gender || ''} voice`.trim(),
        preview_url: voice.preview_url,
        gender: voice.gender,
        in_use: voice.in_use || false,
      }))

      // Filter by gender if not "other"
      const filtered = gender !== 'other'
        ? voices.filter((v) => !v.gender || v.gender === gender)
        : voices

      // Sort: unused first, then alphabetically
      filtered.sort((a, b) => {
        if (a.in_use !== b.in_use) return a.in_use ? 1 : -1
        return a.name.localeCompare(b.name)
      })

      setAvailableVoices(filtered)

      // Auto-select first unused voice
      if (!voiceId && filtered.length > 0) {
        const firstUnused = filtered.find((v) => !v.in_use)
        if (firstUnused) {
          setVoiceId(firstUnused.voice_id)
          setVoiceName(firstUnused.name)
        }
      }
    } catch (err) {
      console.error('Error fetching voices:', err)
      setAvailableVoices([])
    } finally {
      setLoadingVoices(false)
    }
  }

  // Re-fetch voices when gender changes
  useEffect(() => {
    setAvailableVoices([])
    setVoiceId('')
    setVoiceName('')
  }, [gender])

  async function previewVoice(voiceIdToPlay, previewUrl) {
    if (playingVoice === voiceIdToPlay) {
      audioRef.current?.pause()
      setPlayingVoice(null)
      return
    }

    audioRef.current?.pause()
    setPlayingVoice(voiceIdToPlay)

    try {
      const url = previewUrl
      if (!url) {
        setPlayingVoice(null)
        return
      }

      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => setPlayingVoice(null)
      audio.onerror = () => setPlayingVoice(null)
      await audio.play()
    } catch (err) {
      console.error('Error playing voice preview:', err)
      setPlayingVoice(null)
    }
  }

  function openVoiceModal() {
    setShowVoiceModal(true)
    fetchVoicesForModal()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const res = await moderatorsApi.create({
        name,
        type,
        gender,
        bio,
        personality,
        voice_id: voiceId || null,
        voice_name: voiceName || null,
        phrases,
      })

      const moderator = res.data

      // Auto-trigger avatar generation
      try {
        setGeneratingAvatar(true)
        await moderatorsApi.generateAvatar(moderator.id)
      } catch (err) {
        console.error('Avatar generation failed:', err)
      } finally {
        setGeneratingAvatar(false)
      }

      navigate('/moderators')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create moderator')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/moderators"
            className="text-gray-500 hover:text-gray-900 transition flex items-center gap-1 mb-4 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Moderators
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">New Moderator</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Info</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Sarah Chen"
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-900 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-900 cursor-pointer"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Determines avatar appearance and voice options</p>
              </div>
            </div>
          </div>

          {/* Type & Personality */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Type & Personality</h2>

            {/* Type selector chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              {MODERATOR_TYPES.map((t) => {
                const colors = TYPE_CHIP_COLORS[t.value]
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => handleTypeChange(t.value)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      type === t.value ? colors.active : colors.inactive
                    }`}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* Selected type description */}
            <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-gray-500 text-sm">
                {MODERATOR_TYPES.find((t) => t.value === type)?.description}
              </p>
            </div>

            {/* Personality sliders */}
            <div className="space-y-5">
              {PERSONALITY_SLIDERS.map((slider) => {
                const value = personality[slider.key]
                return (
                  <div key={slider.key}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-700 font-medium">{slider.label}</span>
                      <span className="text-gray-400 tabular-nums">{value}/10</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-16">{slider.low}</span>
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
                          onChange={(e) =>
                            setPersonality({ ...personality, [slider.key]: parseInt(e.target.value) })
                          }
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                        {/* Thumb indicator */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md border-2 border-primary transition-all duration-300 ease-out pointer-events-none"
                          style={{ left: `calc(${(value / 10) * 100}% - 8px)` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-16 text-right">{slider.high}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bio */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-sm text-gray-900 placeholder-gray-400"
                placeholder="Short description of this moderator..."
              />
            </div>
          </div>

          {/* Voice */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Voice
            </h2>

            <div className="flex items-center gap-3">
              {/* Voice display */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  voiceId ? 'bg-green-50 text-green-500' : 'bg-gray-100 text-gray-400'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <p className={`font-medium ${voiceId ? 'text-green-600' : 'text-gray-400'}`}>
                    {voiceName || 'No voice selected'}
                  </p>
                  <p className="text-xs text-gray-400">Showing {gender} voices only</p>
                </div>
              </div>

              {/* Select voice button */}
              <button
                type="button"
                onClick={openVoiceModal}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 hover:border-gray-300 rounded-lg text-sm text-gray-600 transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
                {voiceId ? 'Change' : 'Select'}
              </button>
            </div>
          </div>

          {/* Facilitation Phrases */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Facilitation Phrases</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Line</label>
                <input
                  type="text"
                  value={phrases.opening}
                  onChange={(e) => setPhrases({ ...phrases, opening: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transition Phrases (one per line)</label>
                <textarea
                  value={phrases.transitions.join('\n')}
                  onChange={(e) =>
                    setPhrases({ ...phrases, transitions: e.target.value.split('\n').filter(Boolean) })
                  }
                  rows={4}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closing Line</label>
                <input
                  type="text"
                  value={phrases.closing}
                  onChange={(e) => setPhrases({ ...phrases, closing: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Link
              to="/moderators"
              className="px-6 py-2 text-gray-500 hover:text-gray-900 transition text-sm font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || generatingAvatar}
              className="px-6 py-2 bg-primary text-white disabled:opacity-50 rounded-lg font-medium transition hover:opacity-90 text-sm"
            >
              {saving ? 'Creating...' : generatingAvatar ? 'Generating Avatar...' : 'Create Moderator'}
            </button>
          </div>
        </form>
      </div>

      {/* Voice Selection Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-gray-200 max-h-[80vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg text-gray-900">Select Voice</h2>
                <p className="text-sm text-gray-500">
                  Choose a voice for {name || 'this moderator'}
                  {gender && gender !== 'other' && (
                    <span className="ml-1">({gender} voices only)</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVoiceModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {loadingVoices ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {availableVoices.map((voice) => {
                    const isSelected = voiceId === voice.voice_id
                    const isInUse = voice.in_use && !isSelected

                    return (
                      <div
                        key={voice.voice_id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer ${
                          isSelected
                            ? 'bg-primary/5 border-primary/30'
                            : isInUse
                            ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleVoiceSelect(voice)}
                      >
                        {/* Preview button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            previewVoice(voice.voice_id, voice.preview_url)
                          }}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition flex-shrink-0 ${
                            playingVoice === voice.voice_id
                              ? 'bg-primary text-white'
                              : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-700'
                          }`}
                          disabled={!voice.preview_url}
                          title={voice.preview_url ? 'Preview voice' : 'No preview available'}
                        >
                          {playingVoice === voice.voice_id ? (
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

                        {/* Voice info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                              {voice.name}
                            </p>
                            {isInUse && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-xs">
                                In Use
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">{voice.description}</p>
                        </div>

                        {/* Selected indicator */}
                        {isSelected ? (
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-6 h-6 border-2 border-gray-300 rounded-full flex-shrink-0" />
                        )}
                      </div>
                    )
                  })}

                  {availableVoices.length === 0 && !loadingVoices && (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No {gender} voices available</p>
                      <p className="text-sm text-gray-400 mt-1">Try changing the gender setting above</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ModeratorNew
