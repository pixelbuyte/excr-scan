import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'
import { joinRoom as trysteroJoin, type Room } from 'trystero/nostr'

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

// Trystero appId namespaces all rooms for this app. Room matching happens over
// redundant public Nostr relays — no broker to run, no sharded peer registry.
const APP_ID = 'excr-scan-compete-v1'

const STATUS_TEXT: Record<ConnStatus, string> = {
  idle:      '',
  server:    'Connecting…',
  waiting:   'Waiting for opponent…',
  pairing:   'Opponent found — linking up…',
  connected: 'Connected!',
  error:     'Connection failed',
}

const CompeteContext = createContext<CompeteApi | null>(null)

export function CompeteProvider({ children }: { children: ReactNode }) {
  const roomRef = useRef<Room | null>(null)
  const sendRef = useRef<((d: Partial<OpponentState>) => void) | null>(null)

  const [roomCode,  setRoomCode]  = useState('')
  const [connected, setConnected] = useState(false)
  const [status,    setStatus]    = useState<ConnStatus>('idle')
  const [opponent,  setOpponent]  = useState<OpponentState>(EMPTY_OPP)
  const [error,     setError]     = useState('')

  // Join a Trystero room by code. onLink fires when the first peer is found.
  function setupRoom(code: string, onLink?: () => void) {
    roomRef.current?.leave()
    setOpponent(EMPTY_OPP)

    const room = trysteroJoin({ appId: APP_ID }, `EXCR-${code}`)
    roomRef.current = room

    const action = room.makeAction<Partial<OpponentState>>('state')
    sendRef.current = (d) => { void action.send(d) }

    action.onMessage = (data) => {
      if (data && typeof data === 'object') {
        setOpponent(prev => ({ ...prev, ...data }))
      }
    }

    room.onPeerJoin = () => {
      setConnected(true)
      setStatus('connected')
      // Immediate handshake so both panels populate
      try { void action.send({ reps: 0, formScore: 0 }) } catch { /* */ }
      onLink?.()
    }

    room.onPeerLeave = () => {
      setConnected(false)
      setStatus('error')
      setError('Opponent disconnected')
    }

    return room
  }

  const createRoom = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const code = Math.random().toString(36).replace(/[^a-z0-9]/g, '').substring(0, 6).toUpperCase().padEnd(6, 'X')
      setError('')
      setStatus('waiting')
      setRoomCode(code)
      setupRoom(code)
      // Room is live immediately; host just waits for a peer.
      resolve(code)
    })
  }, [])

  const joinRoom = useCallback((code: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const clean = code.toUpperCase().trim()
      setError('')
      setStatus('pairing')

      const timeout = setTimeout(() => {
        setStatus('error')
        setError('No room with that code — check it and that the host is waiting')
        roomRef.current?.leave()
        roomRef.current = null
        reject(new Error('timeout'))
      }, 25000)

      setupRoom(clean, () => {
        clearTimeout(timeout)
        setRoomCode(clean)
        resolve()
      })
    })
  }, [])

  const broadcast = useCallback((data: Partial<OpponentState>) => {
    try { sendRef.current?.(data) } catch { /* not linked yet */ }
  }, [])

  const disconnect = useCallback(() => {
    roomRef.current?.leave()
    roomRef.current = null
    sendRef.current = null
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
