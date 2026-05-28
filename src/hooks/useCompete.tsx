import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { generateSecretKey, getPublicKey, finalizeEvent, type Event } from 'nostr-tools/pure'

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

// Compete data rides directly on public Nostr relays — NOT WebRTC. No STUN/TURN,
// so no NAT traversal to fail: phone-on-cellular and PC-on-WiFi just pub/sub to
// the same relays. Same free public infra already trusted for discovery; no
// backend to run (fits the all-local rule). State is tiny + low-frequency.
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
  'wss://nostr-pub.wellorder.net',
]

// Ephemeral event kind (20000-29999): relays broadcast but never store these.
const KIND = 20001
const PEER_TIMEOUT = 14000   // peer considered gone if silent this long
const HEARTBEAT = 4000       // presence keepalive when state isn't changing

const STATUS_TEXT: Record<ConnStatus, string> = {
  idle:      '',
  server:    'Connecting to relays…',
  waiting:   'Waiting for opponent…',
  pairing:   'Finding opponent…',
  connected: 'Connected!',
  error:     'Connection failed',
}

const CompeteContext = createContext<CompeteApi | null>(null)

export function CompeteProvider({ children }: { children: ReactNode }) {
  const poolRef  = useRef<SimplePool | null>(null)
  const subRef   = useRef<{ close: () => void } | null>(null)
  const skRef    = useRef<Uint8Array | null>(null)
  const pkRef    = useRef<string>('')
  const tagRef   = useRef<string>('')
  const stateRef = useRef<OpponentState>({ ...EMPTY_OPP })   // our latest outgoing state
  const hbRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const peerSeen = useRef<number>(0)                          // last time we heard a peer

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

  function publish(obj: object) {
    const pool = poolRef.current, sk = skRef.current
    if (!pool || !sk) return
    const ev = finalizeEvent({
      kind: KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['t', tagRef.current]],
      content: JSON.stringify(obj),
    }, sk)
    // Swallow per-relay errors (rate limits, dropped sockets) — one relay
    // refusing must never reject into the app; others still carry the event.
    for (const p of pool.publish(RELAYS, ev)) Promise.resolve(p).catch(() => {})
  }

  function teardown() {
    if (hbRef.current) { clearInterval(hbRef.current); hbRef.current = null }
    subRef.current?.close(); subRef.current = null
    poolRef.current?.close(RELAYS); poolRef.current = null
    skRef.current = null; pkRef.current = ''; tagRef.current = ''
    peerSeen.current = 0
  }

  // Join a room channel over the relays. onLink fires the first time we hear a peer.
  function setupRoom(code: string, onLink?: () => void) {
    teardown()
    setOpponent(EMPTY_OPP)
    stateRef.current = { ...EMPTY_OPP }

    const sk = generateSecretKey()
    skRef.current = sk
    pkRef.current = getPublicKey(sk)
    tagRef.current = `excr-${code.toLowerCase()}`
    dbg(`opening channel ${tagRef.current}`)

    const pool = new SimplePool()
    poolRef.current = pool

    subRef.current = pool.subscribeMany(
      RELAYS,
      { kinds: [KIND], '#t': [tagRef.current], since: Math.floor(Date.now() / 1000) - 5 },
      {
        onevent: (ev: Event) => {
          if (ev.pubkey === pkRef.current) return            // ignore our own echoes
          const first = peerSeen.current === 0
          peerSeen.current = Date.now()
          if (first) {
            dbg(`opponent online ${ev.pubkey.slice(0, 6)}`)
            setConnected(true)
            setStatus('connected')
            publish({ ...stateRef.current, hello: 1 })          // answer so they see us too
            onLink?.()
          }
          try {
            const data = JSON.parse(ev.content)
            if (data && typeof data === 'object') {
              setOpponent(prev => ({
                reps:      typeof data.reps === 'number' ? data.reps : prev.reps,
                formScore: typeof data.formScore === 'number' ? data.formScore : prev.formScore,
                exercise:  typeof data.exercise === 'string' ? data.exercise : prev.exercise,
                phase:     data.phase === 'up' || data.phase === 'down' ? data.phase : prev.phase,
              }))
            }
          } catch { /* non-state heartbeat */ }
        },
        oneose: () => dbg('relays subscribed'),
      }
    )

    // Heartbeat: announce presence + latest state; detect a peer going silent.
    hbRef.current = setInterval(() => {
      publish({ ...stateRef.current, hb: 1 })
      if (peerSeen.current && Date.now() - peerSeen.current > PEER_TIMEOUT) {
        dbg('opponent went silent')
        setConnected(false)
        setStatus('error')
        setError('Opponent disconnected')
        peerSeen.current = 0
      }
    }, HEARTBEAT)

    publish({ ...stateRef.current, hello: 1 })                 // initial presence ping
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

  const joinRoom = useCallback((code: string): Promise<void> => {
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
    const sig = JSON.stringify(next)
    if (sig === lastSent.current) return        // skip unchanged — spare the relays
    lastSent.current = sig
    publish(next)
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
