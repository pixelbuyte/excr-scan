import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'
import Peer, { type DataConnection } from 'peerjs'

export interface OpponentState {
  reps: number
  formScore: number
  exercise: string
  phase: 'up' | 'down'
}

interface CompeteApi {
  roomCode: string
  connected: boolean
  waiting: boolean
  opponent: OpponentState
  error: string
  createRoom: () => Promise<string>
  joinRoom: (code: string) => Promise<void>
  broadcast: (data: Partial<OpponentState>) => void
  disconnect: () => void
}

const EMPTY_OPP: OpponentState = { reps: 0, formScore: 0, exercise: 'squat', phase: 'up' }

const CompeteContext = createContext<CompeteApi | null>(null)

// Single shared peer instance across the whole app so the connection
// survives navigation from the lobby into the scanner.
export function CompeteProvider({ children }: { children: ReactNode }) {
  const peerRef = useRef<Peer | null>(null)
  const connRef = useRef<DataConnection | null>(null)

  const [roomCode,  setRoomCode]  = useState('')
  const [connected, setConnected] = useState(false)
  const [opponent,  setOpponent]  = useState<OpponentState>(EMPTY_OPP)
  const [error,     setError]     = useState('')
  const [waiting,   setWaiting]   = useState(false)

  function onData(data: unknown) {
    if (typeof data === 'object' && data !== null) {
      setOpponent(prev => ({ ...prev, ...(data as Partial<OpponentState>) }))
    }
  }

  function bindConn(conn: DataConnection) {
    connRef.current = conn
    conn.on('open',  () => { setConnected(true); setWaiting(false) })
    conn.on('data',  onData)
    conn.on('close', () => setConnected(false))
    conn.on('error', () => setConnected(false))
  }

  const createRoom = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Clean any prior peer
      peerRef.current?.destroy()
      const code = Math.random().toString(36).substring(2, 8).toUpperCase().padEnd(6, 'X')
      const peer = new Peer(`EXCR-${code}`, { debug: 0 })
      peerRef.current = peer
      setError('')
      setWaiting(true)

      const timeout = setTimeout(() => reject(new Error('Connection timed out — check your network')), 15000)

      peer.on('open', () => {
        clearTimeout(timeout)
        setRoomCode(code)
        resolve(code)
      })
      peer.on('connection', (conn) => bindConn(conn))
      peer.on('error', (e) => {
        clearTimeout(timeout)
        setError(e.message)
        setWaiting(false)
        reject(e)
      })
    })
  }, [])

  const joinRoom = useCallback((code: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      peerRef.current?.destroy()
      const peer = new Peer({ debug: 0 })
      peerRef.current = peer
      setError('')

      const timeout = setTimeout(() => reject(new Error('Could not reach room — check the code')), 15000)

      peer.on('open', () => {
        const conn = peer.connect(`EXCR-${code.toUpperCase().trim()}`, { reliable: true })
        bindConn(conn)
        conn.on('open', () => {
          clearTimeout(timeout)
          setRoomCode(code.toUpperCase())
          resolve()
        })
        conn.on('error', (e) => { clearTimeout(timeout); reject(e) })
      })
      peer.on('error', (e) => {
        clearTimeout(timeout)
        setError(e.message)
        reject(e)
      })
    })
  }, [])

  const broadcast = useCallback((data: Partial<OpponentState>) => {
    try { connRef.current?.send(data) } catch { /* not connected yet */ }
  }, [])

  const disconnect = useCallback(() => {
    connRef.current?.close()
    peerRef.current?.destroy()
    peerRef.current = null
    connRef.current = null
    setConnected(false)
    setRoomCode('')
    setWaiting(false)
    setOpponent(EMPTY_OPP)
  }, [])

  return (
    <CompeteContext.Provider value={{ roomCode, connected, waiting, opponent, error, createRoom, joinRoom, broadcast, disconnect }}>
      {children}
    </CompeteContext.Provider>
  )
}

export function useCompete(): CompeteApi {
  const ctx = useContext(CompeteContext)
  if (!ctx) throw new Error('useCompete must be used within CompeteProvider')
  return ctx
}
