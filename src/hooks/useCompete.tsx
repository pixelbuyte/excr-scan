import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'
import { joinRoom, type Room, type DataPayload } from 'trystero/nostr'

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
  debug: string[]
  createRoom: () => Promise<string>
  joinRoom: (code: string) => Promise<void>
  broadcast: (data: Partial<OpponentState>) => void
  disconnect: () => void
}

const EMPTY_OPP: OpponentState = { reps: 0, formScore: 0, exercise: 'squat', phase: 'up' }

// Discovery rides Trystero's Nostr signaling (no backend); the actual game data
// runs over a real WebRTC data channel. Phone-on-cellular <-> PC-on-WiFi sit
// behind different NATs, so a relay (TURN) is mandatory — STUN alone can't punch
// symmetric/cellular NAT. These metered.ca creds are verified to relay a data
// channel relay-only (turn-check.mjs). Creds are client-visible by design; this
// is a free relay key, not a secret.
const TURN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:global.relay.metered.ca:80', username: '7c7b35f393b14fb5c4da85f2', credential: 'aRHWgTv9TfjeqV8d' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '7c7b35f393b14fb5c4da85f2', credential: 'aRHWgTv9TfjeqV8d' },
  { urls: 'turn:global.relay.metered.ca:443', username: '7c7b35f393b14fb5c4da85f2', credential: 'aRHWgTv9TfjeqV8d' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '7c7b35f393b14fb5c4da85f2', credential: 'aRHWgTv9TfjeqV8d' },
]

const APP_ID = 'excr-scan-compete-v1'

const STATUS_TEXT: Record<ConnStatus, string> = {
  idle:      '',
  server:    'Connecting…',
  waiting:   'Waiting for opponent…',
  pairing:   'Finding opponent…',
  connected: 'Connected!',
  error:     'Connection failed',
}

const CompeteContext = createContext<CompeteApi | null>(null)

export function CompeteProvider({ children }: { children: ReactNode }) {
  const roomRef    = useRef<Room | null>(null)
  const sendRef    = useRef<((data: OpponentState) => void) | null>(null)
  const stateRef   = useRef<OpponentState>({ ...EMPTY_OPP })   // our latest outgoing state
  const peerCount  = useRef(0)

  const [roomCode,  setRoomCode]  = useState('')
  const [connected, setConnected] = useState(false)
  const [status,    setStatus]    = useState<ConnStatus>('idle')
  const [opponent,  setOpponent]  = useState<OpponentState>(EMPTY_OPP)
  const [error,     setError]     = useState('')
  const [debug,     setDebug]     = useState<string[]>([])

  const lastDbg = useRef('')
  const dbg = (m: string) => {
    if (m === lastDbg.current) return
    lastDbg.current = m
    const t = new Date().toTimeString().slice(0, 8)
    setDebug(d => [...d.slice(-13), `${t}  ${m}`])
  }

  function teardown() {
    try { roomRef.current?.leave() } catch { /* already gone */ }
    roomRef.current = null
    sendRef.current = null
    peerCount.current = 0
  }

  // Open a room channel. onLink fires the first time a peer's data channel opens.
  function setupRoom(code: string, onLink?: () => void) {
    teardown()
    setOpponent(EMPTY_OPP)
    stateRef.current = { ...EMPTY_OPP }
    peerCount.current = 0

    const ns = `excr-${code.toLowerCase()}`
    dbg(`opening channel ${ns}`)

    const room = joinRoom({ appId: APP_ID, rtcConfig: { iceServers: TURN } }, ns)
    roomRef.current = room

    const action = room.makeAction('s')
    sendRef.current = (s: OpponentState) => { action.send(s as unknown as DataPayload) }

    action.onMessage = (raw) => {
      const data = raw as Partial<OpponentState>
      if (!data || typeof data !== 'object') return
      setOpponent(prev => ({
        reps:      typeof data.reps === 'number' ? data.reps : prev.reps,
        formScore: typeof data.formScore === 'number' ? data.formScore : prev.formScore,
        exercise:  typeof data.exercise === 'string' ? data.exercise : prev.exercise,
        phase:     data.phase === 'up' || data.phase === 'down' ? data.phase : prev.phase,
      }))
    }

    room.onPeerJoin = (id: string) => {
      const first = peerCount.current === 0
      peerCount.current++
      dbg(`opponent online ${id.slice(0, 6)}`)
      setConnected(true)
      setStatus('connected')
      sendRef.current?.(stateRef.current)   // push current state so they sync immediately
      if (first) onLink?.()
    }

    room.onPeerLeave = (id: string) => {
      peerCount.current = Math.max(0, peerCount.current - 1)
      dbg(`opponent left ${id.slice(0, 6)}`)
      if (peerCount.current === 0) {
        setConnected(false)
        setStatus('error')
        setError('Opponent disconnected')
      }
    }
  }

  const createRoom = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const code = Math.random().toString(36).replace(/[^a-z0-9]/g, '').substring(0, 6).toUpperCase().padEnd(6, 'X')
      setError('')
      setDebug([])
      setConnected(false)
      setStatus('waiting')
      setRoomCode(code)
      setupRoom(code)
      resolve(code)        // channel is live; host waits for a peer to appear
    })
  }, [])

  const joinRoomFn = useCallback((code: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const clean = code.toUpperCase().trim()
      setError('')
      setDebug([])
      setConnected(false)
      setStatus('pairing')

      const timeout = setTimeout(() => {
        setStatus('error')
        setError('No opponent on that code — check it and that the host is waiting')
        teardown()
        reject(new Error('timeout'))
      }, 40000)

      setupRoom(clean, () => {
        clearTimeout(timeout)
        setRoomCode(clean)
        resolve()
      })
    })
  }, [])

  const lastSent = useRef('')
  const broadcast = useCallback((data: Partial<OpponentState>) => {
    const next = { ...stateRef.current, ...data }
    stateRef.current = next
    const send = sendRef.current
    if (!send || peerCount.current === 0) return
    const sig = JSON.stringify(next)
    if (sig === lastSent.current) return        // skip unchanged
    lastSent.current = sig
    try { send(next) } catch { /* channel mid-teardown */ }
  }, [])

  const disconnect = useCallback(() => {
    teardown()
    setConnected(false)
    setStatus('idle')
    setRoomCode('')
    setError('')
    setDebug([])
    setOpponent(EMPTY_OPP)
  }, [])

  return (
    <CompeteContext.Provider value={{
      roomCode, connected, waiting: status === 'waiting',
      status, statusText: STATUS_TEXT[status],
      opponent, error, debug, createRoom, joinRoom: joinRoomFn, broadcast, disconnect,
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
