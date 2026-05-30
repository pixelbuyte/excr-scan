import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'
import { joinRoom, type Room, type DataPayload } from 'trystero/nostr'

export interface OpponentState {
  reps: number
  formScore: number
  exercise: string
  phase: 'up' | 'down'
}

export type ConnStatus = 'idle' | 'server' | 'waiting' | 'pairing' | 'connected' | 'error'

// Match lifecycle once both peers are linked: countdown → live (the actual race) → ended (someone won).
export type MatchPhase = 'idle' | 'countdown' | 'live' | 'ended'

interface CompeteApi {
  roomCode: string
  connected: boolean
  waiting: boolean
  status: ConnStatus
  statusText: string
  opponent: OpponentState
  error: string
  debug: string[]
  matchPhase: MatchPhase
  countdownSec: number          // seconds left on the pre-match countdown
  roundId: number               // bumps each round; scanner resets its scores when this changes
  startedEarly: boolean         // I tapped Start Now, waiting on opponent
  createRoom: () => Promise<string>
  joinRoom: (code: string) => Promise<void>
  broadcast: (data: Partial<OpponentState>) => void
  startNow: () => void          // both peers tapping ⇒ skip the countdown
  rematch: () => void           // restart a fresh round on the same connection
  endMatch: () => void          // mark current round finished (a winner emerged)
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
const COUNTDOWN_SECONDS = 5     // pre-match countdown; either side can skip with Start Now

interface CtrlMsg {
  type: 'round' | 'startnow' | 'end'
  roundId: number
  startAt?: number              // epoch ms the round goes live (for 'round')
}

// Trystero's default relay pool is huge and full of slow/dead nodes — peers can
// land on disjoint subsets and take minutes to find each other. Pin a small set
// of known-fast relays so both sides reliably meet on the same sockets fast.
const RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
]

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
  const diagRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Match lifecycle ──────────────────────────────────────────────────────
  const ctrlSendRef = useRef<((m: CtrlMsg) => void) | null>(null)
  const isHostRef   = useRef(false)
  const roundIdRef  = useRef(0)
  const startAtRef  = useRef(0)
  const iStartedRef = useRef(false)   // I tapped Start Now this round
  const theyStartRef = useRef(false)  // opponent tapped Start Now this round
  const cdRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const goTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [roomCode,  setRoomCode]  = useState('')
  const [connected, setConnected] = useState(false)
  const [status,    setStatus]    = useState<ConnStatus>('idle')
  const [opponent,  setOpponent]  = useState<OpponentState>(EMPTY_OPP)
  const [error,     setError]     = useState('')
  const [debug,     setDebug]     = useState<string[]>([])
  const [matchPhase,   setMatchPhase]   = useState<MatchPhase>('idle')
  const [countdownSec, setCountdownSec] = useState(0)
  const [roundId,      setRoundId]      = useState(0)
  const [startedEarly, setStartedEarly] = useState(false)
  const matchPhaseRef = useRef<MatchPhase>('idle')
  matchPhaseRef.current = matchPhase

  const lastDbg = useRef('')
  const dbg = (m: string) => {
    if (m === lastDbg.current) return
    lastDbg.current = m
    const t = new Date().toTimeString().slice(0, 8)
    setDebug(d => [...d.slice(-13), `${t}  ${m}`])
  }

  // ── Round control ──────────────────────────────────────────────────────────
  function goLive() {
    if (cdRef.current) { clearInterval(cdRef.current); cdRef.current = null }
    if (goTimerRef.current) { clearTimeout(goTimerRef.current); goTimerRef.current = null }
    setCountdownSec(0)
    setStartedEarly(false)
    setMatchPhase('live')
  }

  // Drive the countdown clock toward startAtRef. The interval only updates the
  // visible numeral; an authoritative setTimeout owns the flip-to-live so the
  // round still starts on time even if interval ticks get throttled (background
  // tab) and never happen to land exactly on the zero crossing.
  function runCountdown() {
    if (cdRef.current) clearInterval(cdRef.current)
    if (goTimerRef.current) clearTimeout(goTimerRef.current)
    const tick = () => {
      const left = Math.ceil((startAtRef.current - Date.now()) / 1000)
      if (left <= 0) { goLive(); return }
      setCountdownSec(left)
    }
    tick()
    cdRef.current = setInterval(tick, 200)
    goTimerRef.current = setTimeout(goLive, Math.max(0, startAtRef.current - Date.now()))
  }

  // Begin a round locally (both peers run this with the same roundId + startAt).
  function enterRound(rid: number, startAt: number) {
    roundIdRef.current = rid
    startAtRef.current = startAt
    iStartedRef.current = false
    theyStartRef.current = false
    setRoundId(rid)
    setStartedEarly(false)
    setOpponent(EMPTY_OPP)
    stateRef.current = { ...EMPTY_OPP }
    lastSent.current = ''
    setMatchPhase('countdown')
    runCountdown()
  }

  // Initiate a brand-new round and tell the opponent (host on connect, or anyone on rematch).
  function newRound() {
    const rid = roundIdRef.current + 1
    const startAt = Date.now() + COUNTDOWN_SECONDS * 1000
    enterRound(rid, startAt)
    ctrlSendRef.current?.({ type: 'round', roundId: rid, startAt })
  }

  function maybeBothStart() {
    if (iStartedRef.current && theyStartRef.current) {
      startAtRef.current = Date.now()
      goLive()
    }
  }

  function teardown() {
    if (diagRef.current) { clearInterval(diagRef.current); diagRef.current = null }
    if (cdRef.current) { clearInterval(cdRef.current); cdRef.current = null }
    if (goTimerRef.current) { clearTimeout(goTimerRef.current); goTimerRef.current = null }
    try { roomRef.current?.leave() } catch { /* already gone */ }
    roomRef.current = null
    sendRef.current = null
    ctrlSendRef.current = null
    peerCount.current = 0
    roundIdRef.current = 0
    startAtRef.current = 0
    iStartedRef.current = false
    theyStartRef.current = false
    setMatchPhase('idle')
    setCountdownSec(0)
    setRoundId(0)
    setStartedEarly(false)
  }

  // Open a room channel. onLink fires the first time a peer's data channel opens.
  function setupRoom(code: string, onLink?: () => void) {
    teardown()
    setOpponent(EMPTY_OPP)
    stateRef.current = { ...EMPTY_OPP }
    peerCount.current = 0

    const ns = `excr-${code.toLowerCase()}`
    dbg(`opening channel ${ns}`)

    const room = joinRoom({
      appId: APP_ID,
      rtcConfig: { iceServers: TURN },
      relayConfig: { urls: RELAY_URLS, redundancy: RELAY_URLS.length },
    }, ns, {
      onJoinError: (d) => dbg(`relay error: ${d.error}`),
    })
    roomRef.current = room

    // Surface where pairing stalls on a real phone: no peer object ⇒ signaling
    // (Nostr relays) hasn't found the other side; peer exists but ICE stuck on
    // checking/failed ⇒ TURN/NAT problem; connected ⇒ data channel about to open.
    diagRef.current = setInterval(() => {
      if (peerCount.current > 0) return
      const peers = room.getPeers()
      const ids = Object.keys(peers)
      if (ids.length === 0) { dbg('searching relays…'); return }
      const pc = peers[ids[0]]
      dbg(`peer found — link ${pc.iceConnectionState}`)
    }, 2000)

    const action = room.makeAction('s')
    sendRef.current = (s: OpponentState) => { action.send(s as unknown as DataPayload) }

    // Control channel: round starts, early-start requests, match end.
    const ctrl = room.makeAction('c')
    ctrlSendRef.current = (m: CtrlMsg) => { ctrl.send(m as unknown as DataPayload) }
    ctrl.onMessage = (raw) => {
      const m = raw as unknown as CtrlMsg
      if (!m || typeof m !== 'object') return
      if (m.type === 'round' && typeof m.startAt === 'number' && m.roundId > roundIdRef.current) {
        dbg(`round ${m.roundId} starting`)
        enterRound(m.roundId, m.startAt)
      } else if (m.type === 'startnow' && m.roundId === roundIdRef.current) {
        theyStartRef.current = true
        maybeBothStart()
      } else if (m.type === 'end' && m.roundId === roundIdRef.current) {
        setMatchPhase('ended')
      }
    }

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
      // Host owns the first round's clock; send a couple times in case the
      // data channel just opened and the first control message races the link.
      if (isHostRef.current && roundIdRef.current === 0) {
        newRound()
        setTimeout(() => { if (roundIdRef.current >= 1) ctrlSendRef.current?.({ type: 'round', roundId: roundIdRef.current, startAt: startAtRef.current }) }, 700)
      }
    }

    // Joiner fallback: if the host's round message never lands, start one.
    if (!isHostRef.current) {
      setTimeout(() => {
        if (peerCount.current > 0 && roundIdRef.current === 0) { dbg('round fallback'); newRound() }
      }, 2500)
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
      isHostRef.current = true
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
      isHostRef.current = false

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

  const startNow = useCallback(() => {
    if (roundIdRef.current === 0) return
    iStartedRef.current = true
    setStartedEarly(true)
    ctrlSendRef.current?.({ type: 'startnow', roundId: roundIdRef.current })
    maybeBothStart()
  }, [])

  const rematch = useCallback(() => {
    if (peerCount.current === 0) return
    newRound()
  }, [])

  const endMatch = useCallback(() => {
    if (matchPhaseRef.current === 'ended') return
    setMatchPhase('ended')
    ctrlSendRef.current?.({ type: 'end', roundId: roundIdRef.current })
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
      opponent, error, debug,
      matchPhase, countdownSec, roundId, startedEarly,
      createRoom, joinRoom: joinRoomFn, broadcast,
      startNow, rematch, endMatch, disconnect,
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
