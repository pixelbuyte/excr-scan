import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompete } from '../hooks/useCompete'

export default function CompeteLobby() {
  const navigate  = useNavigate()
  const { roomCode, connected, waiting, error, createRoom, joinRoom, disconnect } = useCompete()

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
  if (connected) {
    navigate('/scan', { state: { compete: true, roomCode } })
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: '"Space Mono", monospace',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(0,240,255,0.3)',
    borderRadius: 8,
    color: '#fff',
    padding: '10px 14px',
    width: '100%',
    outline: 'none',
    fontSize: 18,
    letterSpacing: 6,
    textTransform: 'uppercase',
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#0a0a0a', color: '#fff' }}
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1
            className="text-3xl font-black tracking-widest uppercase"
            style={{ fontFamily: '"Orbitron", sans-serif', color: '#39ff14', textShadow: '0 0 16px rgba(57,255,20,0.5)' }}
          >
            Compete
          </h1>
          <p className="text-white/30 text-xs tracking-widest uppercase" style={{ fontFamily: '"Space Mono", monospace' }}>
            Challenge a friend in real-time
          </p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-4 rounded-xl font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40"
              style={{ fontFamily: '"Orbitron", sans-serif', background: '#00f0ff', color: '#000', boxShadow: '0 0 20px rgba(0,240,255,0.4)' }}
            >
              {loading ? 'Creating…' : 'Create Room'}
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-xl font-black uppercase tracking-widest active:scale-95 transition-all"
              style={{ fontFamily: '"Orbitron", sans-serif', color: '#39ff14', background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.3)' }}
            >
              Join Room
            </button>
          </div>
        )}

        {mode === 'host' && (
          <div className="space-y-4">
            <div
              className="rounded-xl p-5 text-center space-y-2"
              style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.3)', animation: 'glow-border 2s ease-in-out infinite' }}
            >
              <p className="text-white/40 text-xs uppercase tracking-widest" style={{ fontFamily: '"Space Mono", monospace' }}>
                Share this code
              </p>
              <div
                className="text-5xl font-black tracking-[0.3em]"
                style={{ fontFamily: '"Orbitron", sans-serif', color: '#00f0ff', textShadow: '0 0 20px rgba(0,240,255,0.7)' }}
              >
                {roomCode}
              </div>
              <p className="text-white/30 text-xs" style={{ fontFamily: '"Space Mono", monospace' }}>
                {waiting ? 'Waiting for opponent to join…' : 'Connected!'}
              </p>
            </div>

            {waiting && (
              <div className="flex justify-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
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
              className="w-full py-4 rounded-xl font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40"
              style={{ fontFamily: '"Orbitron", sans-serif', background: '#00f0ff', color: '#000', boxShadow: '0 0 20px rgba(0,240,255,0.4)' }}
            >
              {loading ? 'Connecting…' : 'Join'}
            </button>
          </div>
        )}

        {(error || localErr) && (
          <p className="text-red-400 text-xs text-center" style={{ fontFamily: '"Space Mono", monospace' }}>
            {error || localErr}
          </p>
        )}

        <button
          onClick={() => { disconnect(); navigate('/') }}
          className="w-full text-white/30 text-sm hover:text-white/60 transition-colors py-2"
          style={{ fontFamily: '"Space Mono", monospace' }}
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
