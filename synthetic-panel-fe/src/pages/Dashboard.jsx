import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { personasApi, panelsApi } from '../services/api'

export default function Dashboard() {
  const [personas, setPersonas] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const carouselRef = useRef(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [personasRes, panelsRes] = await Promise.all([
          personasApi.list(),
          panelsApi.list(),
        ])
        setPersonas(personasRes.data?.items || personasRes.data || [])
        setSessions(panelsRes.data?.items || panelsRes.data || [])
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (personas.length === 0) return
    const cardWidth = 240
    const totalOriginalWidth = personas.length * cardWidth
    const interval = setInterval(() => {
      if (carouselRef.current) {
        const container = carouselRef.current
        if (container.scrollLeft >= totalOriginalWidth) {
          container.scrollTo({ left: 0, behavior: 'instant' })
        }
        container.scrollBy({ left: cardWidth, behavior: 'smooth' })
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [personas.length])

  const carouselPersonas = personas.length > 0 ? [...personas, ...personas] : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Banner — tall, immersive like the original */}
      <div className="relative rounded-2xl overflow-hidden min-h-[380px] flex items-center justify-center">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-tertiary" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.08)_0%,transparent_50%)]" />

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.15)_100%)]" />

        {/* Floating orbs — mimics original animated orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-tertiary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '3s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-white/5 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '1s' }} />

        {/* Dot pattern — like the original svg pattern */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwxKSIgY3g9IjMwIiBjeT0iMzAiIHI9IjIiLz48L2c+PC9zdmc+")`,
        }} />

        {/* Content */}
        <div className="relative text-center px-8 py-14 md:py-16 lg:py-20 max-w-3xl mx-auto">
          {/* Gradient title — like original */}
          <h1 className="text-5xl lg:text-7xl font-bold mb-5 tracking-tight">
            <span className="bg-gradient-to-r from-white via-white/80 to-white bg-clip-text text-transparent">
              Synthetic Panel
            </span>
          </h1>

          {/* Subtitle with accent line — like original */}
          <p className="text-xl lg:text-2xl text-white/60 max-w-2xl mx-auto mb-8">
            AI-powered focus groups with synthetic personas.
            <br />
            <span className="text-white/90">Get authentic consumer insights in minutes.</span>
          </p>

          {/* CTA Buttons — gradient primary like original, larger */}
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/panels/new"
              className="group flex items-center gap-3 px-8 py-4 bg-white text-primary font-bold rounded-xl hover:scale-105 transition-all duration-200 shadow-lg shadow-black/10"
            >
              <svg className="w-5 h-5 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Start New Panel
            </Link>
            <Link
              to="/personas"
              className="flex items-center gap-2.5 px-6 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/20 transition-all duration-200 border border-white/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Browse Personas
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/panels/new" className="group">
          <div className="rounded-xl bg-gradient-to-br from-primary to-tertiary p-6 hover:scale-[1.02] transition-transform h-full">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Start New Panel</h3>
            <p className="text-white/70 text-sm">Run a focus group session</p>
          </div>
        </Link>

        <div className="rounded-xl bg-white border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Overview</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">{personas.length}</div>
              <div className="text-xs text-gray-400">Personas</div>
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="text-3xl font-bold text-gray-900 mb-1">{sessions.length}</div>
              <div className="text-xs text-gray-400">Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {sessions.filter(s => s.status === 'completed').length}
              </div>
              <div className="text-xs text-gray-400">Done</div>
            </div>
          </div>
        </div>

        <Link to="/personas" className="group">
          <div className="rounded-xl bg-white border border-gray-200 p-6 hover:border-primary/30 transition-all h-full">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <svg className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors">View Personas</h3>
            <p className="text-gray-400 text-sm">Browse and chat with your panel</p>
          </div>
        </Link>
      </div>

      {/* Personas Carousel */}
      {personas.length > 0 && (
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Your Personas</h3>
            <Link to="/personas" className="text-sm text-primary hover:opacity-80 transition">View all &rarr;</Link>
          </div>
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none" />
            <div
              ref={carouselRef}
              className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {carouselPersonas.map((persona, index) => (
                <Link key={`${persona.id}-${index}`} to={`/personas/${persona.id}`} className="group flex-shrink-0">
                  <div className="relative w-56 h-72 rounded-2xl overflow-hidden bg-white border border-gray-200 group-hover:border-primary/50 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl group-hover:shadow-primary/10">
                    {persona.avatar_url ? (
                      <img src={persona.avatar_url} alt={persona.name} className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary via-tertiary to-secondary" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h4 className="font-semibold text-white text-sm mb-0.5 drop-shadow-lg">{persona.name}</h4>
                      <p className="text-xs text-white/70">{persona.age} &bull; {persona.city || persona.country}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Sessions</h3>
          <Link to="/panels" className="text-sm text-primary hover:opacity-80">View all &rarr;</Link>
        </div>
        {sessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {sessions.slice(0, 3).map((session) => (
              <Link
                key={session.id}
                to={`/panels/${session.id}`}
                className="group flex items-center gap-3 rounded-xl bg-white border border-gray-200 p-4 hover:border-primary/30 hover:bg-gray-50 transition-all"
              >
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  session.status === 'active' ? 'bg-green-500 animate-pulse' :
                  session.status === 'completed' ? 'bg-primary' : 'bg-gray-300'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate group-hover:text-primary transition">
                    {session.research_goal || session.name || 'Untitled'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {session.status} &bull; {new Date(session.created_at).toLocaleDateString()}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-primary transition flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-400">No sessions yet. Start a new panel to begin!</p>
          </div>
        )}
      </div>
    </div>
  )
}
