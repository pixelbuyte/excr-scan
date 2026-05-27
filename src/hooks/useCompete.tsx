import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'
import Peer, { type DataConnection } from 'peerjs'

export interface OpponentState {
  reps: number
  formScore: number
  exercise: string
  phase: 'up' | 'down'
}

export type ConnStatus = 'idle' | 'server' | 'waiting' | 'pairing' | 'connected' | 'error'

interface CompeteApi {
  roomCode: string
  connected: boolean
  waiting: boolean
  status: ConnStatus
  statusText: string
  opponent: OpponentState
  error: string
  createRoom: () => Promise<string>
  joinRoom: (code: string) => Promise<void>
  broadcast: (data: Partial<OpponentState>) => void
  disconnect: () => void
}

const EMPTY_OPP: OpponentState = { reps: 0, formScore: 0, exercise: 'squat', phase: 'up' }

// STUN (discovery) + free TURN relays (cross-NAT fallback: phone cellular ↔ PC wifi).
// Same-network pairs connect on STUN/host candidates even if TURN is unreachable.
const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'turn:openrelay.metered.ca:80',                username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443',               username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  },
}

const STATUS_TEXT: Record<ConnStatus, string> = {
  idle:      '',
  server:    'Connecting to server…',
  waiting:   'Waiting for opponent…',
  pairing:   'Opponent found — linking up…',
  connected: 'Connected!',
  error:     'Connection failed',
}

const CompeteContext = createContext<CompeteApi | null>(null)

export function CompeteProvider({ children }: { children: ReactNode }) {
  const peerRef = useRef<Peer | null>(null)
  const connRef = useRef<DataConnection | null>(null)

  const [roomCode,  setRoomCode]  = useState('')
  const [connected, setConnected] = useState(false)
  const [status,    setStatus]    = useState<ConnStatus>('idle')
  const [opponent,  setOpponent]  = useState<OpponentState>(EMPTY_OPP)
  const [error,     setError]     = useState('')

  function onData(data: unknown) {
    let obj: unknown = data
    if (typeof data === 'string') { try { obj = JSON.parse(data) } catch { return } }
    if (typeof obj === 'object' && obj !== null) {
      setOpponent(prev => ({ ...prev, ...(obj as Partial<OpponentState>) }))
    }
  }

  function bindConn(conn: DataConnection) {
    connRef.current = conn
    setStatus('pairing')
    conn.on('open', () => {
      setConnected(true)
      setStatus('connected')
      // Immediate handshake so both panels populate without waiting for first tick
      try { conn.send({ reps: 0, formScore: 0 }) } catch { /* */ }
    })
    conn.on('data',  onData)
    conn.on('close', () => { setConnected(false); setStatus('error'); setError('Opponent disconnected') })
    conn.on('error', () => { setConnected(false) })
  }

  // Keep the signalling link alive (mobile browsers drop it on background/idle)
  function attachKeepAlive(peer: Peer) {
    peer.on('disconnected', () => {
      if (!peer.destroyed) { try { peer.reconnect() } catch { /* */ } }
    })
  }

  const createRoom = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      peerRef.current?.destroy()
      const code = Math.random().toString(36).replace(/[^a-z0-9]/g, '').substring(0, 6).toUpperCase().padEnd(6, 'X')
      const peer = new Peer(`EXCR-${code}`, PEER_CONFIG)
      peerRef.current = peer
      setError('')
      setStatus('server')
      attachKeepAlive(peer)

      const timeout = setTimeout(() => {
        setStatus('error'); setError('Server timed out — retry')
        reject(new Error('timeout'))
      }, 20000)

      peer.on('open', () => {
        clearTimeout(timeout)
        setRoomCode(code)
        setStatus('waiting')
        resolve(code)
      })
      peer.on('connection', (conn) => bindConn(conn))
      peer.on('error', (e) => {
        clearTimeout(timeout)
        // Ignore non-fatal post-connection errors
        if (connRef.current) return
        const msg = e.type === 'unavailable-id'
          ? 'Room code clash — retry'
          : e.type === 'network' || e.type === 'server-error'
            ? 'Cannot reach server — check network'
            : e.message
        setStatus('error'); setError(msg)
        reject(e)
      })
    })
  }, [])

  const joinRoom = useCallback((code: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      peerRef.current?.destroy()
      const peer = new Peer(PEER_CONFIG)
      peerRef.current = peer
      setError('')
      setStatus('server')
      attachKeepAlive(peer)

      const timeout = setTimeout(() => {
        setStatus('error'); setError('Could not reach room — check the code')
        reject(new Error('timeout'))
      }, 20000)

      peer.on('open', () => {
        const conn = peer.connect(`EXCR-${code.toUpperCase().trim()}`, { reliable: true, serialization: 'json' })
        bindConn(conn)
        conn.on('open', () => {
          clearTimeout(timeout)
          setRoomCode(code.toUpperCase())
          resolve()
        })
      })
      peer.on('error', (e) => {
        clearTimeout(timeout)
        if (connRef.current?.open) return  // already linked, ignore late errors
        const msg = e.type === 'peer-unavailable'
          ? 'No room with that code'
          : e.type === 'network' || e.type === 'server-error'
            ? 'Cannot reach server — check network'
            : e.message
        setStatus('error'); setError(msg)
        reject(e)
      })
    })
  }, [])

  const broadcast = useCallback((data: Partial<OpponentState>) => {
    try { connRef.current?.send(data) } catch { /* not open yet */ }
  }, [])

  const disconnect = useCallback(() => {
    connRef.current?.close()
    peerRef.current?.destroy()
    peerRef.current = null
    connRef.current = null
    setConnected(false)
    setStatus('idle')
    setRoomCode('')
    setError('')
    setOpponent(EMPTY_OPP)
  }, [])

  return (
    <CompeteContext.Provider value={{
      roomCode, connected, waiting: status === 'waiting',
      status, statusText: STATUS_TEXT[status],
      opponent, error, createRoom, joinRoom, broadcast, disconnect,
    }}>
      {children}
    </CompeteContext.Provider>
  )
}

export function useCompete(): CompeteApi {
  const ctx = useContext(CompeteContext)
  if (!ctx) throw new Error('useCompete must be used within CompeteProvider')
  return ctx
}
