import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompete } from '../hooks/useCompete'
import { Ambient } from '../components/Ambient'
import { glass, glassTint, fontHead, fontMono, softGlow, ACCENT, ACCENT_GREEN } from '../styles/glass'

export default function CompeteLobby() {
  const navigate  = useNavigate()
  const { roomCode, connected, waiting, status, statusText, error, createRoom, joinRoom, disconnect } = useCompete()

  const [mode,      setMode]      = useState<'choose' | 'host' | 'join'>('choose')
  const [joinCode,  setJoinCode]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [localErr,  setLocalErr]  = useState('')

  async function handleCreate() {
    setLoading(true)
    setLocalErr('')
    try {
      await createRoom()
      setMode('host')
    } catch (e) {
      setLocalErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (joinCode.trim().length < 6) { setLocalErr('Enter 6-character room code'); return }
    setLoading(true)
    setLocalErr('')
    try {
      await joinRoom(joinCode.trim())
    } catch (e) {
      setLocalErr('Room not found or connection failed')
    } finally {
      setLoading(false)
    }
  }

  // Once connected, navigate to scanner with compete context
  useEffect(() => {
    if (connected) navigate('/scan', { state: { compete: true, roomCode } })
  }, [connected, roomCode, navigate])

  const inputStyle: React.CSSProperties = {
    ...fontMono,
    ...glass,
    borderRadius: 18,
    color: '#fff',
    padding: '14px 16px',
    width: '100%',
    outline: 'none',
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 relative" style={{ color: '#fff' }}>
      <Ambient />
      <div className="relative z-10 w-full max-w-sm space-y-7">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-5xl">⚔️</div>
          <h1
            className="text-4xl font-black tracking-tight"
            style={{ ...fontHead, background: `linear-gradient(135deg,#fff,${ACCENT_GREEN})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            Compete
          </h1>
          <p className="text-white/40 text-xs tracking-widest uppercase" style={fontMono}>
            Challenge a friend in real-time
          </p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-4 rounded-3xl font-black uppercase tracking-widest active:scale-[0.97] transition-transform disabled:opacity-40"
              style={{ ...fontHead, color: '#04121a', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_GREEN})`, boxShadow: softGlow(ACCENT) }}
            >
              {loading ? 'Creating…' : 'Create Room'}
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-3xl font-black uppercase tracking-widest active:scale-[0.97] transition-transform"
              style={{ ...fontHead, color: ACCENT_GREEN, ...glassTint(ACCENT_GREEN) }}
            >
              Join Room
            </button>
          </div>
        )}

        {mode === 'host' && (
          <div className="space-y-4">
            <div className="rounded-[28px] p-6 text-center space-y-2" style={glassTint(ACCENT)}>
              <p className="text-white/40 text-xs uppercase tracking-widest" style={fontMono}>
                Share this code
              </p>
              <div
                className="text-5xl font-black tracking-[0.3em]"
                style={{ ...fontHead, color: ACCENT, textShadow: `0 0 24px ${ACCENT}99` }}
              >
                {roomCode}
              </div>
              <p className="text-white/45 text-xs" style={fontMono}>
                {statusText || (waiting ? 'Waiting for opponent…' : 'Connected!')}
              </p>
            </div>

            {(status === 'waiting' || status === 'pairing' || status === 'server') && (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
                <span className="text-white/40 text-xs" style={fontMono}>{statusText}</span>
              </div>
            )}
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-3">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              style={inputStyle}
              maxLength={6}
            />

            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full py-4 rounded-3xl font-black uppercase tracking-widest active:scale-[0.97] transition-transform disabled:opacity-40"
              style={{ ...fontHead, color: '#04121a', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_GREEN})`, boxShadow: softGlow(ACCENT) }}
            >
              {loading ? 'Connecting…' : 'Join'}
            </button>

            {(status === 'server' || status === 'pairing') && (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
                <span className="text-white/40 text-xs" style={fontMono}>{statusText}</span>
              </div>
            )}
          </div>
        )}

        {(error || localErr) && (
          <p className="text-red-400 text-xs text-center" style={fontMono}>
            {error || localErr}
          </p>
        )}

        <button
          onClick={() => { disconnect(); navigate('/') }}
          className="w-full text-white/40 text-sm hover:text-white/70 transition-colors py-2"
          style={fontMono}
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
