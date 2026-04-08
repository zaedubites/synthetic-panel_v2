import { useState, useEffect, useRef } from 'react'
import { voiceApi, personasApi } from '../../services/api'

// Predefined voice characteristics for differentiation
const VOICE_CHARACTERISTICS = [
  'high-pitched', 'low-pitched', 'soft', 'loud', 'raspy', 'clear',
  'energetic', 'calm', 'fast-talker', 'slow-talker', 'breathy',
  'nasal', 'warm', 'bright', 'shy', 'confident', 'playful', 'serious',
]

export default function VoiceLibrary() {
  const [activeTab, setActiveTab] = useState('library')
  const [libraryVoices, setLibraryVoices] = useState([])
  const [sharedVoices, setSharedVoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isBrowsing, setIsBrowsing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [ageFilter, setAgeFilter] = useState('')
  const [playingVoice, setPlayingVoice] = useState(null)
  const [editingVoice, setEditingVoice] = useState(null)
  const [addingVoice, setAddingVoice] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [lastQuery, setLastQuery] = useState('')
  // Library filters
  const [libraryGenderFilter, setLibraryGenderFilter] = useState('')
  const [libraryAgeFilter, setLibraryAgeFilter] = useState('')
  const audioRef = useRef(null)

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTargetVoice, setDeleteTargetVoice] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Voice assignments: map of elevenlabs_voice_id -> personas using it
  const [voiceAssignments, setVoiceAssignments] = useState(new Map())

  // Load library voices and persona assignments
  useEffect(() => {
    loadLibraryVoices()
  }, [])

  async function loadLibraryVoices() {
    try {
      const [voicesRes, personasRes] = await Promise.all([
        voiceApi.listLibrary(),
        personasApi.list({ limit: 500 }),
      ])

      const voices = voicesRes.data?.voices || voicesRes.data || []
      setLibraryVoices(Array.isArray(voices) ? voices : [])

      // Build voice -> personas map
      const personas = personasRes.data?.items || personasRes.data || []
      const assignmentMap = new Map()

      for (const p of (Array.isArray(personas) ? personas : [])) {
        if (p.voice_id) {
          const existing = assignmentMap.get(p.voice_id) || []
          existing.push({ id: p.id, name: p.name, avatar_url: p.avatar_url })
          assignmentMap.set(p.voice_id, existing)
        }
      }
      setVoiceAssignments(assignmentMap)
    } catch (err) {
      console.error('Failed to load library:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function browseVoices(overrides) {
    setIsBrowsing(true)
    try {
      const query = overrides?.query ?? searchQuery
      const isLoadMore = overrides?.loadMore ?? false
      const page = isLoadMore ? currentPage + 1 : 1

      const params = { pageSize: 100, page }
      if (query) params.query = query

      const res = await voiceApi.browse(params)
      const data = res.data

      if (data.error) {
        console.error('[Voice Library] API error:', data.error)
        if (!isLoadMore) setSharedVoices([])
      } else if (data.voices) {
        if (isLoadMore) {
          setSharedVoices(prev => [...prev, ...data.voices])
        } else {
          setSharedVoices(data.voices)
        }
        setHasMore(data.has_more ?? false)
        setCurrentPage(page)
        setLastQuery(query)
      } else {
        if (!isLoadMore) setSharedVoices([])
      }
    } catch (err) {
      console.error('Failed to browse voices:', err)
      if (!overrides?.loadMore) setSharedVoices([])
    } finally {
      setIsBrowsing(false)
    }
  }

  function loadMoreVoices() {
    browseVoices({ query: lastQuery, loadMore: true })
  }

  function playPreview(url, voiceId) {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (playingVoice === voiceId) {
      setPlayingVoice(null)
      return
    }
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setPlayingVoice(null)
    audio.onerror = () => setPlayingVoice(null)
    audio.play()
    setPlayingVoice(voiceId)
  }

  async function addToLibrary(voice, settings) {
    try {
      const res = await voiceApi.addToLibrary({
        elevenlabs_voice_id: voice.voice_id,
        name: voice.name,
        description: voice.description,
        age_range: settings.age_range,
        gender: settings.gender,
        language: settings.language,
        preview_url: voice.preview_url,
        notes: settings.notes || '',
        characteristics: settings.characteristics || [],
        verified_languages: settings.verified_languages || [],
        custom_settings: {
          stability: settings.stability,
          similarity_boost: settings.similarity_boost,
          style: settings.style,
          speed: settings.speed,
          gain: settings.gain,
          noise_filter: settings.noise_filter,
        },
      })

      const data = res.data
      if (data.success || data.voice) {
        setLibraryVoices([...libraryVoices, data.voice || data])
        setAddingVoice(null)
        setActiveTab('library')
      } else {
        alert(data.error || 'Failed to add voice')
      }
    } catch (err) {
      console.error('Failed to add voice:', err)
      alert('Failed to add voice')
    }
  }

  async function updateVoice(voice) {
    try {
      const res = await voiceApi.updateLibraryVoice(voice.id, {
        name: voice.name,
        age_range: voice.age_range,
        gender: voice.gender,
        language: voice.language,
        custom_settings: voice.custom_settings,
        is_approved: voice.is_approved,
        notes: voice.notes,
        characteristics: voice.characteristics,
      })

      const data = res.data
      if (data.success || data.voice || data.id) {
        const updated = data.voice || data
        setLibraryVoices(libraryVoices.map(v => v.id === voice.id ? updated : v))
        setEditingVoice(null)
      } else {
        alert(data.error || 'Failed to update voice')
      }
    } catch (err) {
      console.error('Failed to update voice:', err)
      alert('Failed to update voice')
    }
  }

  function confirmDeleteVoice(voice) {
    setDeleteTargetVoice(voice)
    setShowDeleteModal(true)
  }

  async function executeDeleteVoice() {
    if (!deleteTargetVoice) return
    try {
      setIsDeleting(true)
      const res = await voiceApi.deleteLibraryVoice(deleteTargetVoice.id)
      const data = res.data
      if (data.success !== false) {
        setLibraryVoices(libraryVoices.filter(v => v.id !== deleteTargetVoice.id))
      } else {
        alert(data.error || 'Failed to delete voice')
      }
    } catch (err) {
      console.error('Failed to delete voice:', err)
      alert('Failed to delete voice')
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
      setDeleteTargetVoice(null)
    }
  }

  // Filtered library voices
  const filteredLibraryVoices = libraryVoices
    .filter(v => !libraryGenderFilter || v.gender === libraryGenderFilter)
    .filter(v => !libraryAgeFilter || v.age_range === libraryAgeFilter)

  // Filtered browse voices
  const filteredSharedVoices = sharedVoices
    .filter(voice => !genderFilter || voice.gender === genderFilter)
    .filter(voice => !ageFilter || voice.age === ageFilter || voice.age === ageFilter.replace('_', ' '))

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Voice Library</h1>
            <p className="text-gray-500 mt-1">Curated voices for persona generation</p>
          </div>
          <div className="text-sm text-gray-500">
            {libraryVoices.length} voices in library
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('library')}
              className={`py-4 border-b-2 font-medium transition ${
                activeTab === 'library'
                  ? 'border-primary text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              My Library
            </button>
            <button
              onClick={() => {
                setActiveTab('browse')
                if (sharedVoices.length === 0) browseVoices()
              }}
              className={`py-4 border-b-2 font-medium transition ${
                activeTab === 'browse'
                  ? 'border-primary text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              Browse ElevenLabs
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Library Tab */}
        {activeTab === 'library' && (
          <div>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading library...</div>
            ) : libraryVoices.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No voices yet</h3>
                <p className="text-gray-500 mb-4">Browse ElevenLabs to add voices to your library</p>
                <button
                  onClick={() => { setActiveTab('browse'); browseVoices() }}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition"
                >
                  Browse Voices
                </button>
              </div>
            ) : (
              <div>
                {/* Library Filters */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <select
                    value={libraryGenderFilter}
                    onChange={(e) => setLibraryGenderFilter(e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-gray-900"
                  >
                    <option value="">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="neutral">Neutral</option>
                  </select>
                  <select
                    value={libraryAgeFilter}
                    onChange={(e) => setLibraryAgeFilter(e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-gray-900"
                  >
                    <option value="">All Ages</option>
                    <option value="young">Young (8-12)</option>
                    <option value="teen">Teen (13-17)</option>
                    <option value="adult">Adult (18+)</option>
                  </select>
                  {(libraryGenderFilter || libraryAgeFilter) && (
                    <button
                      onClick={() => { setLibraryGenderFilter(''); setLibraryAgeFilter('') }}
                      className="px-4 py-2 text-gray-500 hover:text-gray-900 transition"
                    >
                      Clear filters
                    </button>
                  )}
                  <div className="ml-auto text-sm text-gray-400 self-center">
                    {filteredLibraryVoices.length} of {libraryVoices.length} voices
                  </div>
                </div>

                <div className="grid gap-4">
                  {filteredLibraryVoices.map((voice) => {
                    const assignedPersonas = voiceAssignments.get(voice.elevenlabs_voice_id) || []

                    return (
                      <div
                        key={voice.id}
                        className={`bg-white border rounded-xl p-4 shadow-sm ${
                          assignedPersonas.length > 0 ? 'border-amber-400' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            {/* Play button */}
                            <button
                              onClick={() => voice.preview_url && playPreview(voice.preview_url, voice.id)}
                              className={`w-12 h-12 min-w-[3rem] min-h-[3rem] rounded-full flex items-center justify-center transition flex-shrink-0 ${
                                playingVoice === voice.id
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                              }`}
                            >
                              {playingVoice === voice.id ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900">{voice.name}</h3>
                              {/* Persona assignments */}
                              {assignedPersonas.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {assignedPersonas.map((p) => (
                                    <span
                                      key={p.id}
                                      className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs"
                                    >
                                      Used by {p.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                {/* Inline editable age tag */}
                                <select
                                  value={voice.age_range}
                                  onChange={(e) => updateVoice({ ...voice, age_range: e.target.value })}
                                  className={`px-2 py-0.5 rounded text-xs cursor-pointer border-0 ${
                                    voice.age_range === 'young' ? 'bg-green-100 text-green-700' :
                                    voice.age_range === 'teen' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  <option value="young">young</option>
                                  <option value="teen">teen</option>
                                  <option value="adult">adult</option>
                                </select>
                                {/* Inline editable gender tag */}
                                <select
                                  value={voice.gender}
                                  onChange={(e) => updateVoice({ ...voice, gender: e.target.value })}
                                  className={`px-2 py-0.5 rounded text-xs cursor-pointer border-0 ${
                                    voice.gender === 'male' ? 'bg-sky-100 text-sky-700' :
                                    voice.gender === 'female' ? 'bg-pink-100 text-pink-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  <option value="male">male</option>
                                  <option value="female">female</option>
                                  <option value="neutral">neutral</option>
                                </select>
                                {/* Language tag */}
                                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 uppercase">
                                  {voice.language}
                                </span>
                                {/* Multilingual badge */}
                                {voice.verified_languages && voice.verified_languages.length > 1 && (
                                  <span
                                    className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700"
                                    title={`Verified: ${voice.verified_languages.join(', ')}`}
                                  >
                                    {voice.verified_languages.length} langs
                                  </span>
                                )}
                              </div>
                              {/* Voice characteristics */}
                              {voice.characteristics && voice.characteristics.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {voice.characteristics.map((char) => (
                                    <span
                                      key={char}
                                      className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                                    >
                                      {char}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {/* Notes */}
                              {voice.notes && (
                                <p className="text-xs text-gray-400 mt-2 italic">{voice.notes}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Settings display */}
                            <div className="text-xs text-gray-400 hidden lg:flex gap-2">
                              <span>Speed: {voice.custom_settings?.speed || 1}x</span>
                              {voice.custom_settings?.gain && voice.custom_settings.gain !== 1.0 && (
                                <span className="text-amber-600">Gain: {voice.custom_settings.gain}x</span>
                              )}
                            </div>

                            {/* Edit */}
                            <button
                              onClick={() => setEditingVoice(voice)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-900"
                              title="Edit settings"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => confirmDeleteVoice(voice)}
                              className="p-2 hover:bg-red-50 rounded-lg transition text-gray-400 hover:text-red-600"
                              title="Remove from library"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div>
            {/* Quick Search Presets */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">Quick searches:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Teen Female', query: 'teen female' },
                  { label: 'Teen Male', query: 'teen male' },
                  { label: 'Young Girl', query: 'young girl' },
                  { label: 'Young Boy', query: 'young boy' },
                  { label: 'Kid Voice', query: 'kid child' },
                  { label: 'Child Voice', query: 'child voice' },
                  { label: 'Teenage', query: 'teenage' },
                  { label: 'Youth', query: 'youth young' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setSearchQuery(preset.query)
                      setGenderFilter('')
                      setAgeFilter('')
                      browseVoices({ query: preset.query })
                    }}
                    className="px-3 py-1.5 text-xs bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition text-gray-700"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search voices (e.g., young, child, teen)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && browseVoices()}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-gray-900"
                />
              </div>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              >
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-gray-900"
              >
                <option value="">All Ages</option>
                <option value="young">Young</option>
                <option value="middle_aged">Middle Aged</option>
                <option value="old">Old</option>
              </select>
              <button
                onClick={() => browseVoices()}
                disabled={isBrowsing}
                className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg font-medium transition"
              >
                {isBrowsing ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Results */}
            {isBrowsing ? (
              <div className="text-center py-12 text-gray-500">Searching voices...</div>
            ) : sharedVoices.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No voices found. Try adjusting your search.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredSharedVoices.map((voice) => {
                  const isInLibrary = libraryVoices.some(
                    (v) => v.elevenlabs_voice_id === voice.voice_id
                  )

                  return (
                    <div
                      key={voice.voice_id}
                      className={`bg-white border rounded-xl p-4 shadow-sm ${
                        isInLibrary ? 'border-green-400' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => voice.preview_url && playPreview(voice.preview_url, voice.voice_id)}
                            className={`w-12 h-12 min-w-[3rem] min-h-[3rem] rounded-full flex items-center justify-center transition flex-shrink-0 ${
                              playingVoice === voice.voice_id
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                          >
                            {playingVoice === voice.voice_id ? (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>
                          <div>
                            <h3 className="font-medium text-gray-900">{voice.name}</h3>
                            <p className="text-sm text-gray-500 line-clamp-1">{voice.description}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {voice.gender && (
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  voice.gender === 'male' ? 'bg-sky-100 text-sky-700' :
                                  voice.gender === 'female' ? 'bg-pink-100 text-pink-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {voice.gender}
                                </span>
                              )}
                              {voice.age && (
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  voice.age === 'young' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {voice.age}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 uppercase">
                                {voice.language}
                              </span>
                              {voice.is_multilingual && voice.verified_languages?.length > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700"
                                  title={`Verified: ${voice.verified_languages.join(', ')}`}
                                >
                                  {voice.verified_languages.length} langs
                                </span>
                              )}
                              {voice.accent && (
                                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                  {voice.accent}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {isInLibrary ? (
                            <span className="w-28 text-center px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium">
                              In Library
                            </span>
                          ) : (
                            <button
                              onClick={() => setAddingVoice(voice)}
                              className="w-28 text-center px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium text-sm transition"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Load More */}
                {hasMore && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={loadMoreVoices}
                      disabled={isBrowsing}
                      className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 rounded-lg font-medium transition text-gray-700"
                    >
                      {isBrowsing ? 'Loading...' : 'Load More Voices'}
                    </button>
                  </div>
                )}

                {/* Results count */}
                {sharedVoices.length > 0 && (
                  <div className="mt-4 text-center text-sm text-gray-400">
                    Showing {filteredSharedVoices.length} of {sharedVoices.length} voices {hasMore && '(more available)'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Voice Modal */}
      {addingVoice && (
        <AddVoiceModal
          voice={addingVoice}
          onClose={() => setAddingVoice(null)}
          onAdd={addToLibrary}
        />
      )}

      {/* Edit Voice Modal */}
      {editingVoice && (
        <EditVoiceModal
          voice={editingVoice}
          onClose={() => setEditingVoice(null)}
          onSave={updateVoice}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-gray-200 shadow-xl">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Remove Voice</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to remove &quot;{deleteTargetVoice?.name}&quot; from the library?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteTargetVoice(null) }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDeleteVoice}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
                >
                  {isDeleting ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ──────────────────────────────────────────
// Add Voice Modal
// ──────────────────────────────────────────
function AddVoiceModal({ voice, onClose, onAdd }) {
  const [settings, setSettings] = useState({
    age_range: voice.age === 'young' ? 'young' : voice.age === 'middle_aged' ? 'adult' : 'teen',
    gender: voice.gender || 'neutral',
    language: voice.language || 'en',
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    speed: 1.0,
    gain: 1.0,
    noise_filter: false,
    notes: '',
    characteristics: [],
    verified_languages: voice.verified_languages || [],
  })
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false)
  const audioRef = useRef(null)

  const toggleCharacteristic = (char) => {
    setSettings((prev) => ({
      ...prev,
      characteristics: prev.characteristics.includes(char)
        ? prev.characteristics.filter((c) => c !== char)
        : [...prev.characteristics, char],
    }))
  }

  const playOriginalPreview = () => {
    if (!voice.preview_url) return
    if (audioRef.current) audioRef.current.pause()
    if (isPlayingOriginal) { setIsPlayingOriginal(false); return }
    const audio = new Audio(voice.preview_url)
    audioRef.current = audio
    audio.onended = () => setIsPlayingOriginal(false)
    audio.onerror = () => setIsPlayingOriginal(false)
    audio.play()
    setIsPlayingOriginal(true)
    setIsPlayingPreview(false)
  }

  const playPreviewWithSettings = async () => {
    if (audioRef.current) audioRef.current.pause()
    if (isPlayingPreview) { setIsPlayingPreview(false); return }

    setIsGeneratingPreview(true)
    try {
      const res = await voiceApi.preview({
        text: settings.language === 'de'
          ? 'Hallo! So klinge ich mit den aktuellen Einstellungen.'
          : 'Hello! This is how I sound with the current settings.',
        voice_id: voice.voice_id,
        stability: settings.stability,
        similarity_boost: settings.similarity_boost,
      })

      const audioBlob = new Blob([res.data], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => { setIsPlayingPreview(false); URL.revokeObjectURL(audioUrl) }
      audio.onerror = () => { setIsPlayingPreview(false); URL.revokeObjectURL(audioUrl) }
      audio.play()
      setIsPlayingPreview(true)
      setIsPlayingOriginal(false)
    } catch (err) {
      console.error('Preview error:', err)
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-semibold text-gray-900">Add to Library</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-1">{voice.name}</h3>
            <p className="text-sm text-gray-500 mb-3">{voice.description}</p>
            <div className="flex gap-2">
              <button
                onClick={playOriginalPreview}
                disabled={!voice.preview_url}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                  isPlayingOriginal
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {isPlayingOriginal ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
                Original
              </button>
              <button
                onClick={playPreviewWithSettings}
                disabled={isGeneratingPreview}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                  isPlayingPreview
                    ? 'bg-primary text-white'
                    : 'bg-primary/10 hover:bg-primary/20 text-primary'
                }`}
              >
                {isGeneratingPreview ? (
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : isPlayingPreview ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
                With Settings
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Age Range</label>
              <select
                value={settings.age_range}
                onChange={(e) => setSettings({ ...settings, age_range: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900"
              >
                <option value="young">Young (8-12)</option>
                <option value="teen">Teen (13-17)</option>
                <option value="adult">Adult (18+)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Gender</label>
              <select
                value={settings.gender}
                onChange={(e) => setSettings({ ...settings, gender: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Language</label>
              <select
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900"
              >
                <option value="en">English</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="it">Italian</option>
              </select>
            </div>
          </div>

          {/* Voice characteristics */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">
              Voice Characteristics (for differentiation in focus groups)
            </label>
            <div className="flex flex-wrap gap-2">
              {VOICE_CHARACTERISTICS.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => toggleCharacteristic(char)}
                  className={`px-2 py-1 rounded-full text-xs transition ${
                    settings.characteristics.includes(char)
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {char}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (how to identify this voice)</label>
            <input
              type="text"
              value={settings.notes}
              onChange={(e) => setSettings({ ...settings, notes: e.target.value })}
              placeholder="e.g., 'Bubbly girl with slight lisp' or 'Deep teen boy voice'"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900"
            />
          </div>

          {/* Stability */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Stability: {settings.stability}</label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.stability}
              onChange={(e) => setSettings({ ...settings, stability: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
            <p className="text-xs text-gray-400 mt-1">Lower = more expressive, Higher = more consistent</p>
          </div>

          {/* Speed */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Speed (Pitch): {settings.speed}x</label>
            <input
              type="range" min="0.7" max="1.3" step="0.05"
              value={settings.speed}
              onChange={(e) => setSettings({ ...settings, speed: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
            <p className="text-xs text-gray-400 mt-1">Higher = faster/higher pitch</p>
          </div>

          {/* Similarity Boost */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Similarity Boost: {settings.similarity_boost}</label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.similarity_boost}
              onChange={(e) => setSettings({ ...settings, similarity_boost: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          {/* Volume Gain */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Volume Gain: {settings.gain}x</label>
            <input
              type="range" min="0.5" max="3.0" step="0.1"
              value={settings.gain}
              onChange={(e) => setSettings({ ...settings, gain: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
            <p className="text-xs text-gray-400 mt-1">1.0 = normal, 2.0 = 2x louder (for quiet voices)</p>
          </div>

          {/* Noise Filter */}
          <div className="flex items-center justify-between py-2">
            <div>
              <label className="block text-sm font-medium text-gray-900">Noise Filter</label>
              <p className="text-xs text-gray-400">Apply high/low pass filters to reduce hiss and rumble</p>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, noise_filter: !settings.noise_filter })}
              className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${
                settings.noise_filter ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${
                settings.noise_filter ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <button
            onClick={() => onAdd(voice, settings)}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition"
          >
            Add to Library
          </button>
        </div>
      </div>
    </div>
  )
}


// ──────────────────────────────────────────
// Edit Voice Modal
// ──────────────────────────────────────────
function EditVoiceModal({ voice, onClose, onSave }) {
  const [editedVoice, setEditedVoice] = useState({
    ...voice,
    characteristics: voice.characteristics || [],
    custom_settings: voice.custom_settings || {
      stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1, gain: 1, noise_filter: false,
    },
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const audioRef = useRef(null)

  const toggleCharacteristic = (char) => {
    setEditedVoice((prev) => ({
      ...prev,
      characteristics: prev.characteristics?.includes(char)
        ? prev.characteristics.filter((c) => c !== char)
        : [...(prev.characteristics || []), char],
    }))
  }

  const playOriginalPreview = () => {
    if (!voice.preview_url) return
    if (audioRef.current) audioRef.current.pause()
    if (isPlaying) { setIsPlaying(false); return }
    const audio = new Audio(voice.preview_url)
    audioRef.current = audio
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)
    audio.play()
    setIsPlaying(true)
  }

  const generatePreview = async () => {
    if (!voice.elevenlabs_voice_id) return
    setIsGeneratingPreview(true)
    try {
      const res = await voiceApi.preview({
        text: 'Hello! This is a preview of how I sound with the current settings.',
        voice_id: voice.elevenlabs_voice_id,
        stability: editedVoice.custom_settings.stability,
        similarity_boost: editedVoice.custom_settings.similarity_boost,
      })

      if (audioRef.current) audioRef.current.pause()
      const audioBlob = new Blob([res.data], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(audioUrl) }
      audio.onerror = () => { setIsPlaying(false); URL.revokeObjectURL(audioUrl) }
      audio.play()
      setIsPlaying(true)
    } catch (err) {
      console.error('Preview error:', err)
      alert('Failed to generate preview')
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  const cs = editedVoice.custom_settings

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-semibold text-gray-900">Edit Voice Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview buttons */}
          <div className="flex gap-3">
            <button
              onClick={playOriginalPreview}
              disabled={!voice.preview_url}
              className={`flex-1 py-3 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                isPlaying && !isGeneratingPreview
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              } disabled:opacity-50`}
            >
              {isPlaying && !isGeneratingPreview ? (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                  Stop
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  Play Original
                </>
              )}
            </button>
            <button
              onClick={generatePreview}
              disabled={isGeneratingPreview}
              className="flex-1 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl font-medium transition flex items-center justify-center gap-2"
            >
              {isGeneratingPreview ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Test with Settings
                </>
              )}
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Voice Name</label>
            <input
              type="text"
              value={editedVoice.name}
              onChange={(e) => setEditedVoice({ ...editedVoice, name: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900"
            />
          </div>

          {/* Age / Gender / Language */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Age Range</label>
              <select
                value={editedVoice.age_range}
                onChange={(e) => setEditedVoice({ ...editedVoice, age_range: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900"
              >
                <option value="young">Young</option>
                <option value="teen">Teen</option>
                <option value="adult">Adult</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Gender</label>
              <select
                value={editedVoice.gender}
                onChange={(e) => setEditedVoice({ ...editedVoice, gender: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Language</label>
              <select
                value={editedVoice.language}
                onChange={(e) => setEditedVoice({ ...editedVoice, language: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900"
              >
                <option value="en">English</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="it">Italian</option>
              </select>
            </div>
          </div>

          {/* Voice characteristics */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Voice Characteristics</label>
            <div className="flex flex-wrap gap-2">
              {VOICE_CHARACTERISTICS.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => toggleCharacteristic(char)}
                  className={`px-2 py-1 rounded-full text-xs transition ${
                    editedVoice.characteristics?.includes(char)
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {char}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (how to identify this voice)</label>
            <input
              type="text"
              value={editedVoice.notes || ''}
              onChange={(e) => setEditedVoice({ ...editedVoice, notes: e.target.value })}
              placeholder="e.g., 'Bubbly girl with slight lisp'"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900"
            />
          </div>

          {/* Stability */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Stability: {cs.stability}</label>
            <input
              type="range" min="0" max="1" step="0.05" value={cs.stability}
              onChange={(e) => setEditedVoice({
                ...editedVoice,
                custom_settings: { ...cs, stability: parseFloat(e.target.value) }
              })}
              className="w-full accent-primary"
            />
          </div>

          {/* Speed */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Speed (Pitch): {cs.speed}x</label>
            <input
              type="range" min="0.7" max="1.3" step="0.05" value={cs.speed}
              onChange={(e) => setEditedVoice({
                ...editedVoice,
                custom_settings: { ...cs, speed: parseFloat(e.target.value) }
              })}
              className="w-full accent-primary"
            />
          </div>

          {/* Similarity Boost */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Similarity Boost: {cs.similarity_boost}</label>
            <input
              type="range" min="0" max="1" step="0.05" value={cs.similarity_boost}
              onChange={(e) => setEditedVoice({
                ...editedVoice,
                custom_settings: { ...cs, similarity_boost: parseFloat(e.target.value) }
              })}
              className="w-full accent-primary"
            />
          </div>

          {/* Volume Gain */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Volume Gain: {cs.gain ?? 1.0}x</label>
            <input
              type="range" min="0.5" max="3.0" step="0.1" value={cs.gain ?? 1.0}
              onChange={(e) => setEditedVoice({
                ...editedVoice,
                custom_settings: { ...cs, gain: parseFloat(e.target.value) }
              })}
              className="w-full accent-primary"
            />
            <p className="text-xs text-gray-400 mt-1">1.0 = normal, 2.0 = 2x louder (for quiet voices)</p>
          </div>

          {/* Noise Filter toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <label className="block text-sm font-medium text-gray-900">Noise Filter</label>
              <p className="text-xs text-gray-400">Apply filters to reduce hiss and rumble</p>
            </div>
            <button
              type="button"
              onClick={() => setEditedVoice({
                ...editedVoice,
                custom_settings: { ...cs, noise_filter: !cs.noise_filter }
              })}
              className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${
                cs.noise_filter ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${
                cs.noise_filter ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Noise filter sub-settings */}
          {cs.noise_filter && (
            <>
              <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Hiss Reduction</label>
                    <p className="text-xs text-gray-400">Lower = more aggressive (may affect clarity)</p>
                  </div>
                  <span className="text-sm font-mono text-gray-500">{cs.lowpass_freq || 8000} Hz</span>
                </div>
                <input
                  type="range" min="4000" max="12000" step="500"
                  value={cs.lowpass_freq || 8000}
                  onChange={(e) => setEditedVoice({
                    ...editedVoice,
                    custom_settings: { ...cs, lowpass_freq: parseInt(e.target.value) }
                  })}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>More filtering</span>
                  <span>Less filtering</span>
                </div>
              </div>

              <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Rumble Reduction</label>
                    <p className="text-xs text-gray-400">Higher = removes more low-frequency noise</p>
                  </div>
                  <span className="text-sm font-mono text-gray-500">{cs.highpass_freq || 80} Hz</span>
                </div>
                <input
                  type="range" min="40" max="200" step="10"
                  value={cs.highpass_freq || 80}
                  onChange={(e) => setEditedVoice({
                    ...editedVoice,
                    custom_settings: { ...cs, highpass_freq: parseInt(e.target.value) }
                  })}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Less filtering</span>
                  <span>More filtering</span>
                </div>
              </div>
            </>
          )}

          <button
            onClick={() => onSave(editedVoice)}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
