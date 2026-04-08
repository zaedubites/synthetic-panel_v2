import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { panelsApi, personasApi, moderatorsApi } from '../../services/api'

const DURATIONS = [
  { value: 10, label: '10' },
  { value: 15, label: '15' },
  { value: 30, label: '30' },
  { value: 45, label: '45' },
  { value: 60, label: '60' },
]

const AGE_GROUPS = [
  { id: 'children', label: 'Children', range: '8-12', min: 8, max: 12 },
  { id: 'teens', label: 'Teenagers', range: '13-17', min: 13, max: 17 },
  { id: 'young-adults', label: 'Young Adults', range: '18-25', min: 18, max: 25 },
  { id: 'adults', label: 'Adults', range: '26-40', min: 26, max: 40 },
  { id: 'middle-aged', label: 'Middle Aged', range: '41-55', min: 41, max: 55 },
  { id: 'seniors', label: 'Seniors', range: '56+', min: 56, max: 100 },
]

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
  { code: 'de', name: 'German', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
]

const DEFAULT_LANGUAGE = 'en'

const QUICK_START_SUGGESTIONS = [
  { label: 'Media consumption', goal: 'How do they consume media? What platforms, content types, and viewing habits do they have?' },
  { label: 'Buying habits', goal: 'What influences their purchasing decisions? How do they research and decide on products?' },
  { label: 'Device preferences', goal: 'What devices do they use most? How do they interact with technology daily?' },
  { label: 'Social media', goal: 'Which social platforms do they use and why? What content do they engage with?' },
  { label: 'Brand attitudes', goal: 'How do they perceive popular brands? What makes a brand appealing to them?' },
  { label: 'Daily routines', goal: 'What does a typical day look like? How do they spend their time?' },
]

// Steps: 0-Goal, 1-Who, 2-Duration, 3-Moderation, 4-Mic, 5-Language, 6-Consent, 7-Launch
const TOTAL_STEPS = 8

const CONSENT_TEXT = `By participating in this session, you agree to:

1. Engage respectfully with all participants
2. Stay on topic with the research discussion
3. Not share personal identifying information
4. Understand that responses may be recorded for research purposes
5. Acknowledge that AI-generated personas are used in this session

Your participation helps improve research quality and user experience.`

export default function PanelNew() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [animDir, setAnimDir] = useState('up')
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Form state
  const [researchGoal, setResearchGoal] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE)
  const [selectedAgeGroups, setSelectedAgeGroups] = useState([])
  const [selectedGenders, setSelectedGenders] = useState([])
  const [selectedCities, setSelectedCities] = useState([])
  const [targetDuration, setTargetDuration] = useState(30)
  const [moderationMode, setModerationMode] = useState('ai')
  const [selectedModerator, setSelectedModerator] = useState(null)
  const [selectedPersonas, setSelectedPersonas] = useState([])

  // Mic check state
  const [micStatus, setMicStatus] = useState('idle') // idle, checking, success, error, skipped
  const [audioLevel, setAudioLevel] = useState(0)

  // Consent
  const [consentGiven, setConsentGiven] = useState(false)

  // Data
  const [moderators, setModerators] = useState([])
  const [personas, setPersonas] = useState([])

  // Launch state
  const [launching, setLaunching] = useState(false)
  const [createdSessionId, setCreatedSessionId] = useState(null)
  const [preparing, setPreparing] = useState(false)

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const proceedRef = useRef(() => {})
  const goBackRef = useRef(() => {})

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  // Focus textarea on step 0
  useEffect(() => {
    if (step === 0 && inputRef.current) {
      inputRef.current.focus()
    }
  }, [step])

  const canProceedNow = useCallback(() => {
    switch (step) {
      case 0: return researchGoal.trim().length > 10
      case 1: return selectedPersonas.length >= 1
      case 2: return true
      case 3: return moderationMode === 'self' || selectedModerator !== null
      case 4: return micStatus === 'success' || micStatus === 'skipped'  // Mic check
      case 5: return true  // Language
      case 6: return consentGiven  // Consent
      case 7: return true  // Launch
      default: return true
    }
  }, [step, researchGoal, selectedPersonas, moderationMode, selectedModerator, micStatus, consentGiven])

  // Keep refs updated with current navigation functions
  useEffect(() => {
    proceedRef.current = () => {
      // Mic check step — start check or proceed
      if (step === 4) {
        if (micStatus === 'idle' || micStatus === 'error') {
          startMicCheck()
          return
        }
        if (micStatus === 'success' || micStatus === 'skipped') {
          goToStep(5)
          return
        }
        return
      }
      // Consent step — auto-accept and proceed
      if (step === 6) {
        setConsentGiven(true)
        goToStep(7)
        return
      }
      // Launch step
      if (step === 7) {
        handleLaunch()
        return
      }
      if (canProceedNow()) {
        goToStep(step + 1)
      }
    }
    goBackRef.current = () => {
      if (step > 0) {
        goToStep(step - 1)
      } else {
        navigate('/panels')
      }
    }
  })

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        proceedRef.current()
      }
      if (e.key === 'Escape') {
        goBackRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [step])

  async function loadData() {
    try {
      const [modRes, personaRes] = await Promise.all([
        moderatorsApi.list({ page_size: 50 }),
        personasApi.list({ page_size: 100 }),
      ])

      const mods = modRes.data?.items || modRes.data || []
      const sortedMods = [...mods].sort((a, b) => {
        const aDefault = a.is_default === true
        const bDefault = b.is_default === true
        if (aDefault && !bDefault) return -1
        if (bDefault && !aDefault) return 1
        return 0
      })
      setModerators(sortedMods)
      if (sortedMods.length > 0) {
        setSelectedModerator(sortedMods[0])
      }

      const personaData = personaRes.data?.items || personaRes.data || []
      setPersonas(personaData)
    } catch (err) {
      console.error('Error loading data:', err)
    }
  }

  function canProceed() {
    return canProceedNow()
  }

  // Mic check
  async function startMicCheck() {
    setMicStatus('checking')
    setAudioLevel(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      let maxLevel = 0
      let checkCount = 0
      const checkInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length
        const level = Math.min(100, (avg / 128) * 100)
        setAudioLevel(level)
        if (level > maxLevel) maxLevel = level
        checkCount++
        if (checkCount >= 30) { // 3 seconds
          clearInterval(checkInterval)
          stream.getTracks().forEach(t => t.stop())
          audioContext.close()
          setMicStatus(maxLevel > 10 ? 'success' : 'error')
        }
      }, 100)
    } catch {
      setMicStatus('error')
    }
  }

  function goToStep(newStep) {
    if (isTransitioning || newStep === step) return
    if (newStep < 0 || newStep >= TOTAL_STEPS) return

    setAnimDir(newStep > step ? 'up' : 'down')
    setIsTransitioning(true)

    // Pre-create session when moving to consent step (gives time while user reads)
    if (newStep === 6 && !createdSessionId) {
      createSessionAndPrepare()
    }

    setTimeout(() => {
      setStep(newStep)
      setTimeout(() => setIsTransitioning(false), 50)
    }, 200)
  }

  function nextStep() {
    if (!canProceed()) return
    goToStep(step + 1)
  }

  function prevStep() {
    goToStep(step - 1)
  }

  // Derived filter data
  const availableCities = [...new Set(personas.map((p) => p.city).filter(Boolean))]
  const availableGenders = [...new Set(personas.map((p) => p.gender).filter(Boolean))]

  function toggleAgeGroup(groupId) {
    setSelectedAgeGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    )
  }

  function toggleGender(gender) {
    setSelectedGenders((prev) =>
      prev.includes(gender) ? prev.filter((g) => g !== gender) : [...prev, gender]
    )
  }

  function toggleCity(city) {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    )
  }

  function clearAllFilters() {
    setSelectedAgeGroups([])
    setSelectedGenders([])
    setSelectedCities([])
  }

  const filteredPersonas = personas.filter((persona) => {
    if (selectedAgeGroups.length > 0) {
      if (!persona.age) return false
      const matchesAge = selectedAgeGroups.some((groupId) => {
        const group = AGE_GROUPS.find((g) => g.id === groupId)
        return group && persona.age >= group.min && persona.age <= group.max
      })
      if (!matchesAge) return false
    }
    if (selectedGenders.length > 0) {
      if (!persona.gender || !selectedGenders.includes(persona.gender)) return false
    }
    if (selectedCities.length > 0) {
      if (!persona.city || !selectedCities.includes(persona.city)) return false
    }
    return true
  })

  const hasActiveFilters = selectedAgeGroups.length > 0 || selectedGenders.length > 0 || selectedCities.length > 0

  function togglePersona(persona) {
    if (selectedPersonas.find((p) => p.id === persona.id)) {
      setSelectedPersonas(selectedPersonas.filter((p) => p.id !== persona.id))
    } else {
      setSelectedPersonas([...selectedPersonas, persona])
    }
  }

  async function createSessionAndPrepare() {
    if (createdSessionId) return
    setPreparing(true)

    try {
      const res = await panelsApi.create({
        research_goal: researchGoal,
        moderation_mode: moderationMode,
        moderator_id: selectedModerator?.id || null,
        target_duration_minutes: targetDuration,
        persona_ids: selectedPersonas.map((p) => p.id),
        language: selectedLanguage,
      })

      const panel = res.data
      setCreatedSessionId(panel.id)

      // Start pre-generating opening sequence in background
      panelsApi.prepare(panel.id, { language: selectedLanguage }).then(() => {
        console.log('[PanelSetup] Pre-generation started')
      }).catch((err) => {
        console.error('[PanelSetup] Pre-generation error:', err)
      })
    } catch (err) {
      console.error('Error creating session:', err)
    } finally {
      setPreparing(false)
    }
  }

  async function handleLaunch() {
    if (!canProceed()) return
    setLaunching(true)

    try {
      // If session was already created during pre-step, just redirect
      if (createdSessionId) {
        navigate(`/panels/${createdSessionId}/live`)
        return
      }

      // Fallback: create session now if it was not pre-created
      const res = await panelsApi.create({
        research_goal: researchGoal,
        moderation_mode: moderationMode,
        moderator_id: selectedModerator?.id || null,
        target_duration_minutes: targetDuration,
        persona_ids: selectedPersonas.map((p) => p.id),
        language: selectedLanguage,
      })

      const panel = res.data
      navigate(`/panels/${panel.id}/live`)
    } catch (err) {
      console.error('Error creating panel:', err)
      setLaunching(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-hidden">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Navigation */}
      <div className="absolute top-6 left-6 flex items-center gap-4">
        <button
          onClick={step === 0 ? () => navigate('/panels') : prevStep}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition group"
        >
          <div className="w-10 h-10 rounded-full border border-gray-300 group-hover:border-gray-400 flex items-center justify-center transition">
            {step === 0 ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* Step counter */}
      <div className="absolute top-6 right-6 text-sm text-gray-500">
        {step + 1} / {TOTAL_STEPS}
      </div>

      {/* Main content */}
      <div
        ref={containerRef}
        className="h-full flex items-center justify-center px-8"
      >
        <div className="w-full max-w-3xl">
          {/* Step content with animation */}
          <div
            className={`transition-all duration-300 ease-out ${
              isTransitioning
                ? animDir === 'up'
                  ? 'opacity-0 -translate-y-8'
                  : 'opacity-0 translate-y-8'
                : 'opacity-100 translate-y-0'
            }`}
          >
            {/* Step 0: Research Goal */}
            {step === 0 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight text-gray-900">
                    What do you want to
                    <span className="bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent"> explore</span>?
                  </h1>
                  <p className="text-xl text-gray-500">
                    Describe your research goal and we&apos;ll set up the perfect panel.
                  </p>
                </div>

                <textarea
                  ref={inputRef}
                  value={researchGoal}
                  onChange={(e) => setResearchGoal(e.target.value)}
                  rows={3}
                  placeholder="e.g., Understand buying behavior..."
                  className="w-full text-2xl bg-transparent border-none outline-none resize-none placeholder:text-gray-300 focus:placeholder:text-gray-400 text-gray-900"
                  autoFocus
                />

                <p className="text-sm text-gray-500 flex items-center gap-1.5">
                  <span className="text-primary">&#8594;</span>
                  You&apos;ll select your target audience in the next step
                </p>

                {/* Quick start suggestions */}
                {!researchGoal && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">Quick start:</p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_START_SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion.label}
                          onClick={() => setResearchGoal(suggestion.goal)}
                          className="px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition"
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="px-8 py-3 bg-primary text-white hover:opacity-90 disabled:opacity-50 disabled:hover:opacity-50 rounded-full font-medium transition"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 1: Who - Demographics filter + Persona selection */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
                    Who would you like to
                    <span className="bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent"> ask</span>?
                  </h1>
                  <p className="text-xl text-gray-500">
                    Filter by demographics and select 1-6 participants.
                  </p>
                </div>

                {/* Demographic filters */}
                <div className="space-y-3">
                  {/* Age filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-500 w-16">Age</span>
                    {AGE_GROUPS.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => toggleAgeGroup(group.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          selectedAgeGroups.includes(group.id)
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>

                  {/* Gender filters */}
                  {availableGenders.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-gray-500 w-16">Gender</span>
                      {availableGenders.map((gender) => (
                        <button
                          key={gender}
                          onClick={() => toggleGender(gender)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                            selectedGenders.includes(gender)
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {gender}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* City filters */}
                  {availableCities.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-gray-500 w-16">Location</span>
                      {availableCities.slice(0, 8).map((city) => (
                        <button
                          key={city}
                          onClick={() => toggleCity(city)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            selectedCities.includes(city)
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Clear filters */}
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-gray-500 hover:text-gray-700 transition"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>

                {/* Persona grid */}
                <div className="grid grid-cols-5 gap-3 max-h-[310px] overflow-y-auto py-1">
                  {filteredPersonas.map((persona) => {
                    const isSelected = selectedPersonas.find((p) => p.id === persona.id)
                    return (
                      <button
                        key={persona.id}
                        onClick={() => togglePersona(persona)}
                        className={`p-3 rounded-xl border transition-all h-[140px] flex flex-col items-center justify-center ${
                          isSelected
                            ? 'border-primary ring-1 ring-primary/50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="relative w-12 h-12 flex-shrink-0 mb-2">
                          {persona.avatar_url ? (
                            <img src={persona.avatar_url} alt={persona.name} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">
                              {persona.name?.[0]}
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-white">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-medium truncate w-full text-center text-gray-900">{persona.name}</div>
                        <div className="text-xs text-gray-500 truncate w-full text-center">
                          {persona.age && `${persona.age}yo`}
                          {persona.city && ` \u00B7 ${persona.city}`}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {filteredPersonas.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No personas match your filters. Try adjusting the age groups.
                  </div>
                )}

                <button
                  onClick={nextStep}
                  disabled={selectedPersonas.length < 1}
                  className="px-8 py-3 bg-primary text-white hover:opacity-90 disabled:opacity-50 rounded-full font-medium transition mx-auto block"
                >
                  Continue with {selectedPersonas.length} participant{selectedPersonas.length !== 1 ? 's' : ''}
                </button>
              </div>
            )}

            {/* Step 2: Duration */}
            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
                    How long should the
                    <span className="bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent"> session</span> be?
                  </h1>
                  <p className="text-xl text-gray-500">
                    Pick the ideal duration for your research.
                  </p>
                </div>

                <div className="flex gap-4 justify-center">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setTargetDuration(d.value)}
                      className={`w-20 h-20 rounded-2xl border-2 transition-all ${
                        targetDuration === d.value
                          ? 'border-primary bg-primary/10 scale-110'
                          : 'border-gray-200 hover:border-gray-300 hover:scale-105'
                      }`}
                    >
                      <div className={`text-2xl font-bold ${targetDuration === d.value ? 'text-primary' : 'text-gray-900'}`}>{d.label}</div>
                      <div className="text-xs text-gray-500">min</div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={nextStep}
                  className="px-8 py-3 bg-primary text-white hover:opacity-90 rounded-full font-medium transition mx-auto block"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 3: Moderation */}
            {step === 3 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
                    Who should
                    <span className="bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent"> moderate</span>?
                  </h1>
                  <p className="text-xl text-gray-500">
                    Choose how the conversation will be facilitated.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* AI Moderator option */}
                  <div
                    onClick={() => setModerationMode('ai')}
                    className={`p-6 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      moderationMode === 'ai'
                        ? 'border-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-lg text-gray-900">AI Moderator</div>
                      <div className="text-sm text-gray-500">Professional facilitation</div>
                    </div>

                    {/* Moderator cards inline */}
                    {moderationMode === 'ai' && moderators.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-gray-200">
                        {moderators.map((mod) => (
                          <button
                            key={mod.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedModerator(mod) }}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                              selectedModerator?.id === mod.id
                                ? 'bg-primary/10 ring-1 ring-primary'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            {mod.avatar_url ? (
                              <img src={mod.avatar_url} alt={mod.name} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">
                                {mod.name[0]}
                              </div>
                            )}
                            <span className="text-xs font-medium text-gray-900">{mod.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Self-Moderated option */}
                  <div
                    onClick={() => setModerationMode('self')}
                    className={`p-6 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      moderationMode === 'self'
                        ? 'border-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-lg text-gray-900">Self-Moderated</div>
                      <div className="text-sm text-gray-500">You guide the conversation</div>
                    </div>
                  </div>
                </div>

                {/* Selected moderator name */}
                {moderationMode === 'ai' && selectedModerator && (
                  <div className="text-center text-gray-500">
                    Selected: <span className="text-gray-900 font-medium">{selectedModerator.name}</span>
                  </div>
                )}

                <button
                  onClick={nextStep}
                  disabled={moderationMode === 'ai' && !selectedModerator}
                  className="px-8 py-3 bg-primary text-white hover:opacity-90 disabled:opacity-50 rounded-full font-medium transition mx-auto block"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 4: Mic Check */}
            {step === 4 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
                    Let's check your
                    <span className="bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent"> microphone</span>
                  </h1>
                  <p className="text-xl text-gray-500">
                    Make sure we can hear you clearly during the session.
                  </p>
                </div>

                <div className="flex flex-col items-center gap-6">
                  <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                    micStatus === 'checking' ? 'bg-primary/10 animate-pulse' :
                    micStatus === 'success' ? 'bg-green-50' :
                    micStatus === 'error' ? 'bg-red-50' :
                    'bg-gray-100'
                  }`}>
                    {micStatus === 'checking' && (
                      <div className="absolute inset-0 rounded-full border-4 border-primary transition-transform"
                        style={{ transform: `scale(${1 + audioLevel / 100})` }} />
                    )}
                    <svg className={`w-16 h-16 ${
                      micStatus === 'success' ? 'text-green-500' :
                      micStatus === 'error' ? 'text-red-500' :
                      micStatus === 'checking' ? 'text-primary' :
                      'text-gray-400'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>

                  <div className="text-center">
                    {micStatus === 'idle' && <p className="text-gray-500">Click below to test your microphone</p>}
                    {micStatus === 'checking' && <p className="text-primary">Listening... speak now</p>}
                    {micStatus === 'success' && <p className="text-green-600">Microphone working perfectly!</p>}
                    {micStatus === 'error' && <p className="text-red-500">Could not detect audio. Check your microphone.</p>}
                    {micStatus === 'skipped' && <p className="text-gray-400">Mic check skipped</p>}
                  </div>

                  {micStatus === 'checking' && (
                    <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-tertiary transition-all duration-100"
                        style={{ width: `${audioLevel}%` }} />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 justify-center">
                  {(micStatus === 'idle' || micStatus === 'error') && (
                    <button onClick={startMicCheck}
                      className="px-8 py-3 bg-primary text-white rounded-full font-medium hover:opacity-90 transition">
                      Test Microphone
                    </button>
                  )}
                  {micStatus === 'success' && (
                    <button onClick={nextStep}
                      className="px-8 py-3 bg-primary text-white rounded-full font-medium hover:opacity-90 transition">
                      Continue
                    </button>
                  )}
                  {micStatus !== 'checking' && (
                    <button onClick={() => { setMicStatus('skipped'); goToStep(5) }}
                      className="px-6 py-3 text-gray-500 hover:text-gray-700 font-medium transition">
                      Skip
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Language Selection */}
            {step === 5 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight text-gray-900">
                    Choose your
                    <span className="bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent"> language</span>
                  </h1>
                  <p className="text-xl text-gray-500">
                    Select the language for your panel discussion.
                  </p>
                </div>

                <div className="flex gap-4 justify-center">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setSelectedLanguage(lang.code)}
                      className={`w-36 h-36 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                        selectedLanguage === lang.code
                          ? 'border-primary bg-primary/10 scale-110'
                          : 'border-gray-200 hover:border-gray-300 hover:scale-105'
                      }`}
                    >
                      <span className="text-5xl">{lang.flag}</span>
                      <span className={`text-lg font-medium ${selectedLanguage === lang.code ? 'text-primary' : 'text-gray-900'}`}>{lang.name}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={nextStep}
                  className="px-8 py-3 bg-primary text-white hover:opacity-90 rounded-full font-medium transition mx-auto block"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 6: Consent */}
            {step === 6 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
                    Before we
                    <span className="bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent"> begin</span>
                  </h1>
                  <p className="text-xl text-gray-500">
                    Please review and accept the session guidelines.
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 max-h-[300px] overflow-y-auto">
                  <pre className="text-gray-700 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {CONSENT_TEXT}
                  </pre>
                </div>

                <button
                  onClick={() => { setConsentGiven(true); goToStep(7) }}
                  className="px-8 py-3 bg-primary text-white rounded-full font-medium hover:opacity-90 transition mx-auto block"
                >
                  Agree and Continue
                </button>
              </div>
            )}

            {/* Step 7: Review & Launch */}
            {step === 7 && (
              <div className="space-y-8 text-center">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
                    Ready to
                    <span className="bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent"> launch</span>?
                  </h1>
                </div>

                {/* Panel preview */}
                <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-xl mx-auto shadow-sm">
                  <div className="text-lg text-gray-700 mb-6 text-left">&ldquo;{researchGoal}&rdquo;</div>

                  <div className="flex justify-center gap-3 mb-6">
                    {selectedModerator && moderationMode === 'ai' && (
                      <div className="text-center">
                        {selectedModerator.avatar_url ? (
                          <img src={selectedModerator.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border-4 border-primary mx-auto" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-white border-4 border-primary mx-auto">
                            {selectedModerator.name[0]}
                          </div>
                        )}
                        <div className="text-xs mt-1 text-primary">Host</div>
                      </div>
                    )}
                    {selectedPersonas.map((p) => (
                      <div key={p.id} className="text-center">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-gray-200 mx-auto" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600 border-2 border-gray-200 mx-auto">
                            {p.name[0]}
                          </div>
                        )}
                        <div className="text-xs mt-1 text-gray-500 truncate max-w-[56px]">{p.name}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center gap-8 text-sm text-gray-500">
                    <div>
                      <span className="text-2xl font-bold text-gray-900">{targetDuration}</span> min
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-gray-900">{selectedPersonas.length}</span> panelists
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={handleLaunch}
                    disabled={launching}
                    className={`flex items-center gap-3 px-12 py-4 rounded-full font-semibold text-lg text-white transition-all ${
                      launching
                        ? 'bg-primary animate-pulse'
                        : 'bg-gradient-to-r from-primary to-tertiary hover:opacity-90 hover:scale-105'
                    } disabled:opacity-50`}
                  >
                    {launching ? (
                      <>
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Launching...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Launch Panel
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Launch animation overlay */}
      {launching && (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-50" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div className="text-center">
            <div className="w-32 h-32 mx-auto mb-8 relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ opacity: 0.3 }} />
              <div className="absolute inset-4 rounded-full bg-primary animate-pulse flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-2 text-gray-900">Launching your panel...</h2>
            <p className="text-gray-500">Preparing your research session</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
