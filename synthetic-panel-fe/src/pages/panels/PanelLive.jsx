import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { panelsApi, personasApi, moderatorsApi, voiceApi } from '../../services/api'

// ---------------------------------------------------------------------------
// CSS Animations (injected once)
// ---------------------------------------------------------------------------
const STYLE_ID = 'panel-live-animations'
function injectAnimations() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes speaking-ring {
      0%   { transform: scale(1);    opacity: 0.6; }
      100% { transform: scale(1.08); opacity: 0;   }
    }
    @keyframes sound-bar {
      0%, 100% { height: 4px; }
      50%      { height: var(--bar-height); }
    }
  `
  document.head.appendChild(style)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const AVATAR_COLORS = [
  'bg-violet-200 text-violet-700',
  'bg-rose-200 text-rose-700',
  'bg-amber-200 text-amber-700',
  'bg-emerald-200 text-emerald-700',
  'bg-sky-200 text-sky-700',
  'bg-fuchsia-200 text-fuchsia-700',
  'bg-teal-200 text-teal-700',
  'bg-orange-200 text-orange-700',
]

function avatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function initial(name) {
  return (name || 'P')[0].toUpperCase()
}

function gridCols(count) {
  if (count <= 1) return 'grid-cols-1'
  if (count <= 4) return 'grid-cols-2'
  return 'grid-cols-3'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SoundBars({ color = 'bg-primary' }) {
  const heights = [12, 18, 14, 20, 10]
  return (
    <div className="flex items-end justify-center gap-[3px] h-5 mt-1">
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${color}`}
          style={{
            '--bar-height': `${h}px`,
            animation: 'sound-bar 0.8s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
            height: '4px',
          }}
        />
      ))}
    </div>
  )
}

function SpeakingRing({ color = 'border-primary' }) {
  return (
    <span
      className={`absolute inset-0 rounded-full border-2 ${color}`}
      style={{
        animation: 'speaking-ring 1.4s ease-out infinite',
      }}
    />
  )
}

function ParticipantTile({ persona, index, isSpeaking, isModerator }) {
  const accentText = isModerator ? 'text-cyan-600' : 'text-primary'
  const accentBorder = isModerator ? 'border-cyan-500' : 'border-primary'
  const accentRing = isModerator ? 'border-cyan-400' : 'border-primary'
  const accentBg = isModerator ? 'bg-cyan-500' : 'bg-primary'
  const barColor = isModerator ? 'bg-cyan-500' : 'bg-primary'

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Avatar container */}
      <div className="relative">
        {isSpeaking && <SpeakingRing color={accentRing} />}
        {persona.avatar_url ? (
          <img
            src={persona.avatar_url}
            alt={persona.name}
            className={`w-32 h-32 md:w-44 md:h-44 rounded-full object-cover transition-all duration-300 ${
              isSpeaking ? `border-4 ${accentBorder} shadow-lg` : 'border-4 border-white shadow-md'
            }`}
          />
        ) : (
          <div
            className={`w-32 h-32 md:w-44 md:h-44 rounded-full flex items-center justify-center text-3xl md:text-5xl font-bold transition-all duration-300 ${
              isSpeaking
                ? `border-4 ${accentBorder} shadow-lg ${avatarColor(index)}`
                : `border-4 border-white shadow-md ${avatarColor(index)}`
            }`}
          >
            {initial(persona.name)}
          </div>
        )}
      </div>

      {/* Name + badge */}
      <div className="flex flex-col items-center gap-0.5">
        <span
          className={`text-sm md:text-base font-semibold transition-colors duration-300 ${
            isSpeaking ? accentText : 'text-gray-800'
          }`}
        >
          {persona.name}
        </span>
        {isModerator && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white ${accentBg}`}>
            Host
          </span>
        )}
      </div>

      {/* Sound bars */}
      {isSpeaking && <SoundBars color={barColor} />}
    </div>
  )
}

function TranscriptMessage({ msg, isSpeaking, isRevealed }) {
  const isUser = msg.role === 'user'
  const isModerator = msg.role === 'moderator'

  const nameColor = isUser ? 'text-blue-600' : isModerator ? 'text-cyan-600' : 'text-primary'

  // Hide persona/moderator messages until they are being spoken or have been spoken
  const isQueued = !isRevealed && !isSpeaking
  if ((msg.role === 'persona' || msg.role === 'moderator') && isQueued && !isUser) {
    return null
  }

  return (
    <div
      className={`flex gap-2.5 px-3 py-2 rounded-lg transition-all duration-300 ${
        isSpeaking ? 'bg-primary/5' : ''
      }`}
    >
      {/* Small avatar */}
      <div className="flex-shrink-0 pt-0.5">
        {msg.avatar_url ? (
          <img src={msg.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              isUser
                ? 'bg-blue-100 text-blue-600'
                : isModerator
                ? 'bg-cyan-100 text-cyan-600'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {isUser ? 'Y' : initial(msg.persona_name || (isModerator ? 'M' : 'P'))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${nameColor}`}>
            {isUser ? 'You' : isModerator ? 'Moderator' : msg.persona_name || 'Persona'}
          </span>
          {isSpeaking && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              Speaking
            </span>
          )}
        </div>
        <p className="text-sm text-gray-700 leading-relaxed mt-0.5">{msg.content}</p>
      </div>
    </div>
  )
}

function ExitModal({ onBackground, onSaveExit, onDiscard, onCancel, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">Leave Session</h3>
        <p className="text-sm text-gray-500 mb-5">What would you like to do?</p>

        <div className="flex flex-col gap-3">
          {/* Run in Background */}
          <button
            onClick={onBackground}
            disabled={saving}
            className="w-full px-5 py-4 bg-gradient-to-r from-primary to-tertiary text-white rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-4 text-left"
          >
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <div className="font-semibold">Run in Background</div>
              <div className="text-sm text-white/70">Continue without you</div>
            </div>
          </button>

          {/* Save & Exit */}
          <button
            onClick={onSaveExit}
            disabled={saving}
            className="w-full px-5 py-4 bg-gray-100 text-gray-900 rounded-xl hover:bg-gray-200 transition disabled:opacity-50 flex items-center gap-4 text-left"
          >
            <svg className="w-6 h-6 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <div className="font-semibold">{saving ? 'Saving...' : 'Save & Exit'}</div>
              <div className="text-sm text-gray-500">End and keep results</div>
            </div>
          </button>

          {/* Abandon */}
          <button
            onClick={onDiscard}
            disabled={saving}
            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition disabled:opacity-50 flex items-center gap-4 text-left"
          >
            <svg className="w-6 h-6 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <div>
              <div className="font-semibold">Abandon</div>
              <div className="text-sm text-gray-400">Discard all results</div>
            </div>
          </button>
        </div>

        <button
          onClick={onCancel}
          disabled={saving}
          className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 transition text-center"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function PanelLive() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Panel & transcript
  const [panel, setPanel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [waitingForQuestion, setWaitingForQuestion] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [autoSendCountdown, setAutoSendCountdown] = useState(null)
  const recognitionRef = useRef(null)
  const countdownRef = useRef(null)

  // Audio
  const [audioQueue, setAudioQueue] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSpeakingId, setCurrentSpeakingId] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [spokenMessageIds, setSpokenMessageIds] = useState(new Set())
  const audioRef = useRef(new Audio())
  const queuedIdsRef = useRef(new Set())
  const spokenIdsRef = useRef(new Set()) // mirror for sync access

  // Session
  const [showExitModal, setShowExitModal] = useState(false)
  const [exitSaving, setExitSaving] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)

  // WebSocket
  const wsRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const MAX_RECONNECT_ATTEMPTS = 3

  // Refs
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // Inject CSS animations
  useEffect(() => {
    injectAnimations()
  }, [])

  // ---------------------------------------------------------------------------
  // Derived: participants list
  // ---------------------------------------------------------------------------
  const participants = useMemo(() => {
    if (!panel) return []
    const personas = panel.personas || panel.participants || []
    // Put moderator first if present
    const moderator = panel.moderator
    const list = []
    if (moderator) {
      list.push({ ...moderator, _isModerator: true })
    }
    for (const p of personas) {
      list.push({ ...p, _isModerator: false })
    }
    return list
  }, [panel])

  // Map persona name/id -> participant for quick lookup
  const participantMap = useMemo(() => {
    const map = {}
    for (const p of participants) {
      if (p.id) map[p.id] = p
      if (p.name) map[p.name] = p
    }
    return map
  }, [participants])

  // ---------------------------------------------------------------------------
  // Enqueue new messages for TTS
  // ---------------------------------------------------------------------------
  const enqueueNewMessages = useCallback((msgs) => {
    const newAudioItems = []
    const immediateSpoken = new Set()

    for (const msg of msgs) {
      if (msg.role !== 'persona' && msg.role !== 'moderator') continue
      if (!msg.id || queuedIdsRef.current.has(msg.id)) continue

      const voiceId = msg.voice_id || msg.message_metadata?.voice_id
      queuedIdsRef.current.add(msg.id)

      if (voiceId && !isMuted) {
        newAudioItems.push({
          id: msg.id,
          text: msg.content,
          voice_id: voiceId,
          persona_name: msg.persona_name || msg.message_metadata?.persona_name || 'Persona',
        })
      } else {
        // No voice or muted — still queue for visual "speaking" highlight
        // Use a fake audio item with no voice_id to trigger the highlight
        newAudioItems.push({
          id: msg.id,
          text: msg.content,
          voice_id: null, // Will skip TTS but still highlight
          persona_name: msg.persona_name || msg.message_metadata?.persona_name || 'Persona',
        })
      }
    }

    if (immediateSpoken.size > 0) {
      setSpokenMessageIds((prev) => {
        const next = new Set(prev)
        for (const mid of immediateSpoken) next.add(mid)
        return next
      })
    }

    if (newAudioItems.length > 0) {
      console.log(`[Audio] Enqueueing ${newAudioItems.length} items:`, newAudioItems.map(i => `${i.persona_name}(${i.voice_id ? 'voice' : 'no-voice'})`).join(', '))
      setAudioQueue((prev) => [...prev, ...newAudioItems])
    }
  }, [])

  // ---------------------------------------------------------------------------
  // WebSocket connection
  // ---------------------------------------------------------------------------
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8003'
    const token = localStorage.getItem('synthetic_panel_token')
    const ws = new WebSocket(`${WS_URL}/ws/panels/${id}?token=${token}`)

    ws.onopen = () => {
      console.log('WebSocket connected')
      reconnectAttemptsRef.current = 0
    }

    ws.onmessage = (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch {
        console.error('Failed to parse WebSocket message:', event.data)
        return
      }

      switch (data.type) {
        case 'connected':
          // Connection confirmed — send start_session if not already started
          if (!sessionStarted) {
            ws.send(JSON.stringify({ type: 'start_session' }))
            setSessionStarted(true)
          }
          break

        case 'session_started':
          // Session is now running
          break

        case 'message': {
          const msg = data.message
          if (!msg) break
          setMessages((prev) => [...prev, msg])

          // Mark user messages as spoken immediately
          if (msg.role === 'user' && msg.id) {
            spokenIdsRef.current.add(msg.id)
            queuedIdsRef.current.add(msg.id)
            setSpokenMessageIds((prev) => new Set([...prev, msg.id]))
          } else {
            // Enqueue persona/moderator messages for TTS
            enqueueNewMessages([msg])
          }
          break
        }

        case 'session_ended':
          console.log('Session ended')
          break

        case 'error':
          console.error('WebSocket error from server:', data.message)
          break

        case 'pong':
          break

        case 'user_joined':
        case 'user_left':
        case 'typing_indicator':
          // Could handle these if needed
          break

        default:
          console.log('Unknown WebSocket message type:', data.type)
      }
    }

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason)
      wsRef.current = null

      // Attempt reconnection if unexpected close
      if (event.code !== 1000 && event.code !== 1001 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1
        console.log(`Reconnecting (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`)
        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket()
        }, 3000)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    wsRef.current = ws
  }, [id, enqueueNewMessages, sessionStarted])

  // ---------------------------------------------------------------------------
  // Initial load: fetch panel data, then connect WebSocket
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const [panelRes, transcriptRes] = await Promise.all([
          panelsApi.get(id),
          panelsApi.getTranscript(id),
        ])

        if (cancelled) return

        const panelData = panelRes.data

        // Fetch actual persona objects for participant_ids
        if (panelData.participant_ids?.length > 0) {
          try {
            const personaPromises = panelData.participant_ids.map(pid => personasApi.get(pid))
            const personaResults = await Promise.all(personaPromises)
            panelData.personas = personaResults.map(r => r.data)
          } catch (err) {
            console.error('Failed to fetch participant personas:', err)
            panelData.personas = []
          }
        }

        // Fetch moderator if set
        if (panelData.moderator_id && !panelData.moderator) {
          try {
            const modRes = await moderatorsApi.get(panelData.moderator_id)
            panelData.moderator = modRes.data
          } catch (err) {
            console.error('Failed to fetch moderator:', err)
          }
        }

        setPanel(panelData)

        const msgs = transcriptRes.data?.messages || []
        setMessages(msgs)
        // Mark all existing messages as spoken (they are historical)
        const historical = new Set()
        for (const m of msgs) {
          if (m.id) {
            historical.add(m.id)
            queuedIdsRef.current.add(m.id)
            spokenIdsRef.current.add(m.id)
          }
        }
        setSpokenMessageIds(historical)

        // Connect WebSocket after panel data is loaded
        if (!cancelled) {
          connectWebSocket()
        }
      } catch (error) {
        console.error('Failed to fetch panel data:', error)
      }
    }

    init()
    return () => { cancelled = true }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        // Send stop_session before closing
        try {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'stop_session' }))
          }
        } catch {
          // Ignore
        }
        wsRef.current.close(1000, 'Component unmounted')
        wsRef.current = null
      }
    }
  }, [])

  // Auto-scroll transcript
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ---------------------------------------------------------------------------
  // Audio queue processor — uses ref to avoid cancellation on queue changes
  // ---------------------------------------------------------------------------
  const isPlayingRef = useRef(false)
  const audioQueueRef = useRef(audioQueue)
  audioQueueRef.current = audioQueue

  const processNextInQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return

    const item = audioQueueRef.current[0]
    console.log(`[Audio] Processing: ${item.persona_name}, voice: ${item.voice_id ? 'yes' : 'no'}, queue: ${audioQueueRef.current.length}`)
    isPlayingRef.current = true
    setIsPlaying(true)
    setCurrentSpeakingId(item.id)

    const markDone = () => {
      spokenIdsRef.current.add(item.id)
      setSpokenMessageIds((prev) => new Set([...prev, item.id]))
      setCurrentSpeakingId(null)
      isPlayingRef.current = false
      setIsPlaying(false)
      setAudioQueue((prev) => prev.slice(1))
    }

    // No voice or muted — visual highlight only
    if (!item.voice_id || isMuted) {
      const readingTime = Math.max(1500, Math.min(item.text.length * 40, 5000))
      console.log(`[Audio] Visual-only for ${item.persona_name} (${readingTime}ms)`)
      await new Promise((r) => setTimeout(r, readingTime))
      markDone()
      return
    }

    try {
      console.log(`[Audio] TTS request for ${item.persona_name}...`)
      const response = await Promise.race([
        voiceApi.preview({ text: item.text, voice_id: item.voice_id }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TTS timeout')), 15000)),
      ])
      console.log(`[Audio] TTS got ${response.data?.byteLength || 0} bytes`)

      const blob = new Blob([response.data], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)

      await new Promise((resolve) => {
        const audio = audioRef.current
        audio.onended = () => {
          console.log(`[Audio] Ended: ${item.persona_name}`)
          URL.revokeObjectURL(url)
          resolve()
        }
        audio.onerror = () => {
          console.error(`[Audio] Error: ${item.persona_name}`)
          URL.revokeObjectURL(url)
          resolve()
        }
        audio.src = url
        audio.play().then(() => {
          console.log(`[Audio] Playing: ${item.persona_name}`)
        }).catch((e) => {
          console.warn(`[Audio] Autoplay blocked: ${e.name}`)
          URL.revokeObjectURL(url)
          resolve() // Don't hang — move on
        })
      })
    } catch (err) {
      console.error(`[Audio] Failed: ${item.persona_name}:`, err.message)
      // Fallback: visual highlight
      const readingTime = Math.max(1500, Math.min(item.text.length * 40, 3000))
      await new Promise((r) => setTimeout(r, readingTime))
    }

    // Brief pause between speakers
    await new Promise((r) => setTimeout(r, 300))
    markDone()
  }, [isMuted])

  // Trigger queue processing when items are added or current finishes
  useEffect(() => {
    if (!isPlaying && audioQueue.length > 0) {
      processNextInQueue()
    }
  }, [audioQueue.length, isPlaying, processNextInQueue])

  // Mute: stop playback, clear queue
  useEffect(() => {
    if (isMuted) {
      audioRef.current.pause()
      audioRef.current.src = ''
      // Mark all queued items as spoken so text reveals
      setAudioQueue((prev) => {
        for (const item of prev) {
          spokenIdsRef.current.add(item.id)
        }
        setSpokenMessageIds((s) => {
          const next = new Set(s)
          for (const item of prev) next.add(item.id)
          return next
        })
        return []
      })
      setIsPlaying(false)
      setCurrentSpeakingId(null)
    }
  }, [isMuted])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [])

  // ---------------------------------------------------------------------------
  // WebSocket ping keepalive
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // ---------------------------------------------------------------------------
  // Raise Hand (AI-moderated mode)
  // ---------------------------------------------------------------------------
  const handleRaiseHand = () => {
    if (handRaised || sending) return
    setHandRaised(true)

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'raise_hand' }))
      // After sending raise_hand, show the input for the user to type
      setWaitingForQuestion(true)
    } else {
      setHandRaised(false)
      console.error('WebSocket not connected')
    }
  }

  const handleCancelHand = () => {
    setHandRaised(false)
    setWaitingForQuestion(false)
    setInput('')
    stopRecording()
  }

  // Speech recognition — matches reference app pattern
  const silenceTimeoutRef = useRef(null)
  const countdownIntervalRef = useRef(null)
  const lastTranscriptRef = useRef('')

  const startRecording = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Edge.')
      return
    }

    if (isRecording || sending) return

    // Clear any pending timers
    if (silenceTimeoutRef.current) { clearTimeout(silenceTimeoutRef.current); silenceTimeoutRef.current = null }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
    setAutoSendCountdown(null)
    lastTranscriptRef.current = ''

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    // Set language based on panel language
    const langMap = { en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT' }
    recognition.lang = langMap[panel?.language] || 'en-US'

    recognition.onstart = () => setIsRecording(true)

    recognition.onend = () => {
      // If recognition ends with pending text, send it
      if (lastTranscriptRef.current.trim() && !sending) {
        const text = lastTranscriptRef.current.trim()
        lastTranscriptRef.current = ''
        setInput('')
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'send_message', content: text }))
        }
      }
      setIsRecording(false)
      setAutoSendCountdown(null)
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('')
      setInput(transcript)
      lastTranscriptRef.current = transcript

      // Clear pending timers
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
      setAutoSendCountdown(null)

      // Check if any result is final
      const hasFinal = Array.from(event.results).some((r) => r.isFinal)

      if (hasFinal && transcript.trim()) {
        // Start 2-second auto-send countdown
        const countdownSeconds = 2
        setAutoSendCountdown(countdownSeconds)

        let remaining = countdownSeconds
        countdownIntervalRef.current = setInterval(() => {
          remaining -= 1
          if (remaining > 0) {
            setAutoSendCountdown(remaining)
          } else {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
            setAutoSendCountdown(null)
          }
        }, 1000)

        // Auto-send after countdown
        silenceTimeoutRef.current = setTimeout(() => {
          if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
          setAutoSendCountdown(null)

          const text = lastTranscriptRef.current.trim()
          lastTranscriptRef.current = ''
          setInput('')

          if (text && !sending) {
            recognition.stop()
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'send_message', content: text }))
            }
          }
        }, countdownSeconds * 1000)
      }
    }

    recognition.onerror = (event) => {
      setIsRecording(false)
      setAutoSendCountdown(null)
      // Ignore common non-errors
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopRecording = () => {
    if (silenceTimeoutRef.current) { clearTimeout(silenceTimeoutRef.current); silenceTimeoutRef.current = null }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
    setAutoSendCountdown(null)
    setIsRecording(false)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
  }

  const toggleRecording = () => {
    if (isRecording) stopRecording()
    else startRecording()
  }

  // ---------------------------------------------------------------------------
  // Send message via WebSocket
  // ---------------------------------------------------------------------------
  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim() || sending) return

    const messageText = input.trim()
    setInput('')
    setSending(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'send_message', content: messageText }))
    } else {
      console.error('WebSocket not connected')
      setInput(messageText) // Restore input
    }

    setSending(false)

    // Reset raise hand state after sending
    if (handRaised) {
      setHandRaised(false)
      setWaitingForQuestion(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Exit handlers
  // ---------------------------------------------------------------------------
  const handleSaveExit = async () => {
    setExitSaving(true)
    // Stop auto-continuation
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_session' }))
    }
    try {
      await panelsApi.end(id, { generate_analysis: true })
      navigate(`/panels/${id}`)
    } catch (error) {
      console.error('Failed to end panel:', error)
      setExitSaving(false)
    }
  }

  const handleBackground = () => {
    // Stop audio and close WebSocket
    audioRef.current.pause()
    setAudioQueue([])
    if (wsRef.current) {
      wsRef.current.onclose = null // prevent reconnection
      wsRef.current.close()
      wsRef.current = null
    }

    // Show toast notification
    const toast = document.createElement('div')
    toast.className = 'fixed bottom-6 right-6 z-[100] bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-2xl flex items-center gap-3'
    toast.style.animation = 'slideUp 0.3s ease-out'
    toast.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <svg class="w-4 h-4 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <div>
        <p class="font-medium text-gray-900 text-sm">Running panel in background</p>
        <p class="text-xs text-gray-500">We'll notify you when it's ready</p>
      </div>
    `
    if (!document.getElementById('toast-anim')) {
      const style = document.createElement('style')
      style.id = 'toast-anim'
      style.textContent = '@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }'
      document.head.appendChild(style)
    }
    document.body.appendChild(toast)
    setTimeout(() => {
      toast.style.opacity = '0'
      toast.style.transform = 'translateY(20px)'
      toast.style.transition = 'all 0.3s ease-out'
      setTimeout(() => toast.remove(), 300)
    }, 5000)

    // Navigate immediately
    navigate('/panels')

    // Fire-and-forget background generation
    panelsApi.background?.(id) || fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8003'}/api/panels/${id}/background`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('synthetic_panel_token')}`,
        'X-Organization-Id': JSON.parse(localStorage.getItem('synthetic_panel_org') || '{}').id || '',
      },
    }).catch(err => console.error('Background generation error:', err))
  }

  const handleDiscard = async () => {
    setExitSaving(true)
    // Stop auto-continuation
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_session' }))
    }
    try {
      await panelsApi.end(id, { discard: true })
      navigate('/panels')
    } catch (error) {
      console.error('Failed to discard panel:', error)
      setExitSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Textarea auto-expand
  // ---------------------------------------------------------------------------
  const handleInputChange = (e) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (!panel) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading session...</span>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Find which participant is currently speaking
  // ---------------------------------------------------------------------------
  const currentSpeakingMessage = messages.find((m) => String(m.id) === String(currentSpeakingId))
  const speakingPersonaName = currentSpeakingMessage?.persona_name || currentSpeakingMessage?.message_metadata?.persona_name
  const speakingPersonaId = currentSpeakingMessage?.persona_id || currentSpeakingMessage?.message_metadata?.persona_id

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ====== HEADER ====== */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">
              {panel.research_goal || panel.name || 'Live Panel'}
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                LIVE
              </span>
              <span className="text-xs text-gray-400">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
              {audioQueue.length > 0 && !isMuted && (
                <span className="text-xs text-primary font-medium">
                  {audioQueue.length} in queue
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mute toggle */}
          <button
            onClick={() => setIsMuted((prev) => !prev)}
            className={`p-2 rounded-lg border transition ${
              isMuted
                ? 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'
                : 'bg-white border-gray-200 text-primary hover:bg-primary/5'
            }`}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>

          {/* Exit button */}
          <button
            onClick={() => setShowExitModal(true)}
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-red-500 hover:border-red-200 transition"
            title="End session"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* ====== MAIN CONTENT ====== */}
      <div className="flex flex-1 min-h-0">
        {/* ---- Left: Participant Grid ---- */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
          {participants.length === 0 ? (
            <p className="text-sm text-gray-400">No participants</p>
          ) : (
            <div className={`grid ${gridCols(participants.length)} gap-8 md:gap-12`}>
              {participants.map((p, idx) => {
                const isSpeaking =
                  (speakingPersonaId && String(speakingPersonaId) === String(p.id)) ||
                  (speakingPersonaName && speakingPersonaName === p.name)

                return (
                  <ParticipantTile
                    key={p.id || idx}
                    persona={p}
                    index={idx}
                    isSpeaking={isSpeaking}
                    isModerator={p._isModerator}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* ---- Right: Transcript Sidebar ---- */}
        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Transcript</h2>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto py-2 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full px-4">
                <p className="text-xs text-gray-400 text-center">
                  The conversation will appear here once it starts.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isUser = msg.role === 'user'
                const isSpeaking = currentSpeakingId === msg.id
                // User messages and moderator messages always revealed
                const isRevealed = isUser || spokenMessageIds.has(msg.id) || isSpeaking

                return (
                  <TranscriptMessage
                    key={msg.id || index}
                    msg={msg}
                    isSpeaking={isSpeaking}
                    isRevealed={isRevealed}
                  />
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* ====== FOOTER: Input Controls ====== */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* AI-Moderated: Raise Hand Flow */}
          {panel?.moderation_mode === 'ai' && !waitingForQuestion && (
            <div className="flex items-center justify-between">
              <button
                onClick={handleRaiseHand}
                disabled={handRaised || sending}
                className={`flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition ${
                  handRaised
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-60`}
              >
                {handRaised ? (
                  <>
                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    Please wait...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                    </svg>
                    Raise Hand
                  </>
                )}
              </button>
              <p className="text-sm text-gray-400">
                {handRaised ? 'The moderator will call on you shortly...' : 'Raise your hand to ask a question'}
              </p>
            </div>
          )}

          {/* AI-Moderated: Input visible after hand raised & acknowledged */}
          {panel?.moderation_mode === 'ai' && waitingForQuestion && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-primary font-medium">The moderator has called on you — ask your question:</p>
                <button onClick={handleCancelHand} className="text-xs text-gray-400 hover:text-gray-600 transition">Cancel</button>
              </div>

              {/* Auto-send countdown */}
              {autoSendCountdown !== null && autoSendCountdown > 0 && (
                <div className="flex items-center gap-2 text-sm text-cyan-600">
                  <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  Sending in {autoSendCountdown}s...
                  <button onClick={() => { setAutoSendCountdown(null) }} className="text-xs text-gray-400 hover:text-gray-600 ml-2">Cancel auto-send</button>
                </div>
              )}

              <form onSubmit={handleSend} className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { handleInputChange(e); setAutoSendCountdown(null) }}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? 'Listening... speak now' : 'Type or use mic to ask your question...'}
                  autoFocus
                  disabled={sending}
                  rows={2}
                  className={`flex-1 px-4 py-2.5 bg-gray-50 border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50 resize-none ${
                    isRecording ? 'border-red-300 focus:border-red-400 bg-red-50/30' : 'border-primary/30 focus:border-primary'
                  }`}
                  style={{ maxHeight: '160px' }}
                />

                {/* Mic button */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`p-2.5 rounded-xl transition flex-shrink-0 ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse hover:bg-red-600'
                      : 'bg-gray-100 text-gray-500 hover:bg-cyan-50 hover:text-cyan-600'
                  }`}
                  title={isRecording ? 'Stop recording' : 'Speak your question'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>

                {/* Send button */}
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                  Send
                </button>
              </form>
            </div>
          )}

          {/* Self-Moderated: Direct input always visible */}
          {panel?.moderation_mode !== 'ai' && (
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => { handleInputChange(e); setAutoSendCountdown(null) }}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? 'Listening... speak now' : 'Ask a question to the panel...'}
                disabled={sending}
                rows={2}
                className={`flex-1 px-4 py-2.5 bg-gray-50 border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50 resize-none ${
                  isRecording ? 'border-red-300 bg-red-50/30' : 'border-gray-200 focus:border-primary'
                }`}
                style={{ maxHeight: '160px' }}
              />
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-2.5 rounded-xl transition flex-shrink-0 ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse hover:bg-red-600'
                    : 'bg-gray-100 text-gray-500 hover:bg-cyan-50 hover:text-cyan-600'
                }`}
                title={isRecording ? 'Stop recording' : 'Speak your question'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                Send
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ====== EXIT MODAL ====== */}
      {showExitModal && (
        <ExitModal
          onBackground={handleBackground}
          onSaveExit={handleSaveExit}
          onDiscard={handleDiscard}
          onCancel={() => setShowExitModal(false)}
          saving={exitSaving}
        />
      )}
    </div>
  )
}
