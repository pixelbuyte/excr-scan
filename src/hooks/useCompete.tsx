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
  debug: string[]
  createRoom: () => Promise<string>
  joinRoom: (code: string) => Promise<void>
  broadcast: (data: Partial<OpponentState>) => void
  disconnect: () => void
}

const EMPTY_OPP: OpponentState = { reps: 0, formScore: 0, exercise: 'squat', phase: 'up' }

// Trystero appId namespaces all rooms for this app. Room matching happens over
// redundant public Nostr relays — no broker to run, no sharded peer registry.
const APP_ID = 'excr-scan-compete-v1'

// Relays find the peer; the WebRTC link still has to cross NATs. Phone-on-cellular
// ↔ PC-on-WiFi are different NATs that STUN alone can't punch — without TURN the
// peer is discovered but the data channel never opens (lobby spinner hangs).
// Free public TURN (openrelay, no signup); :443?transport=tcp survives networks
// that block UDP. No backend to run — fits the all-local constraint.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
}

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
  const monRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const [roomCode,  setRoomCode]  = useState('')
  const [connected, setConnected] = useState(false)
  const [status,    setStatus]    = useState<ConnStatus>('idle')
  const [opponent,  setOpponent]  = useState<OpponentState>(EMPTY_OPP)
  const [error,     setError]     = useState('')
  const [debug,     setDebug]     = useState<string[]>([])

  const lastDbg = useRef('')
  const dbg = (m: string) => {
    if (m === lastDbg.current) return            // dedupe consecutive identical
    lastDbg.current = m
    const t = new Date().toTimeString().slice(0, 8)
    setDebug(d => [...d.slice(-13), `${t}  ${m}`])
  }

  // Poll Trystero's underlying RTCPeerConnections so the lobby can show whether
  // a peer was ever discovered (relay/signaling worked) and how far ICE got
  // (host/srflx => direct, relay => via TURN, failed => NAT couldn't be crossed).
  function startMonitor(room: Room) {
    if (monRef.current) clearInterval(monRef.current)
    let sawPeer = false
    monRef.current = setInterval(() => {
      try {
        const peers = (room as unknown as { getPeers?: () => Record<string, RTCPeerConnection> }).getPeers?.() || {}
        const ids = Object.keys(peers)
        if (!ids.length) { if (!sawPeer) dbg('searching… no peer yet'); return }
        sawPeer = true
        const pc = peers[ids[0]]
        dbg(`ice:${pc.iceConnectionState} conn:${pc.connectionState}`)
        if (pc.connectionState === 'connected') {
          pc.getStats().then(stats => {
            stats.forEach(r => {
              if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.localCandidateId) {
                const local = stats.get(r.localCandidateId)
                if (local) dbg(`linked via ${local.candidateType}`) // relay = TURN used
              }
            })
          }).catch(() => {})
        }
      } catch { /* getPeers unavailable on this build */ }
    }, 1500)
  }

  function stopMonitor() {
    if (monRef.current) { clearInterval(monRef.current); monRef.current = null }
  }

  // Join a Trystero room by code. onLink fires when the first peer is found.
  function setupRoom(code: string, onLink?: () => void) {
    roomRef.current?.leave()
    stopMonitor()
    setOpponent(EMPTY_OPP)
    dbg(`joining EXCR-${code}`)

    const room = trysteroJoin({ appId: APP_ID, rtcConfig: RTC_CONFIG }, `EXCR-${code}`)
    roomRef.current = room
    startMonitor(room)

    const action = room.makeAction<Partial<OpponentState>>('state')
    sendRef.current = (d) => { void action.send(d) }

    action.onMessage = (data) => {
      if (data && typeof data === 'object') {
        setOpponent(prev => ({ ...prev, ...data }))
      }
    }

    room.onPeerJoin = (peerId?: string) => {
      dbg(`peer joined ${String(peerId ?? '').slice(0, 6)} — channel open`)
      setConnected(true)
      setStatus('connected')
      // Immediate handshake so both panels populate
      try { void action.send({ reps: 0, formScore: 0 }) } catch { /* */ }
      onLink?.()
    }

    room.onPeerLeave = () => {
      dbg('peer left')
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
      setDebug([])
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
      setDebug([])
      setStatus('pairing')

      const timeout = setTimeout(() => {
        setStatus('error')
        setError('Could not link up — peer found but connection blocked, or no host on that code')
        stopMonitor()
        roomRef.current?.leave()
        roomRef.current = null
        reject(new Error('timeout'))
      }, 40000)

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
    stopMonitor()
    roomRef.current?.leave()
    roomRef.current = null
    sendRef.current = null
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
      opponent, error, debug, createRoom, joinRoom, broadcast, disconnect,
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
