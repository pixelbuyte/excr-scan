import { useState, useRef, useCallback } from 'react'
import Peer, { type DataConnection } from 'peerjs'

export interface OpponentState {
  reps: number
  formScore: number
  exercise: string
  phase: 'up' | 'down'
}

export function useCompete() {
  const peerRef = useRef<Peer | null>(null)
  const connRef = useRef<DataConnection | null>(null)

  const [roomCode,    setRoomCode]    = useState('')
  const [connected,   setConnected]   = useState(false)
  const [opponent,    setOpponent]    = useState<OpponentState>({ reps: 0, formScore: 0, exercise: 'squat', phase: 'up' })
  const [error,       setError]       = useState('')
  const [waiting,     setWaiting]     = useState(false)

  function onData(data: unknown) {
    if (typeof data === 'object' && data !== null) {
      setOpponent(prev => ({ ...prev, ...(data as Partial<OpponentState>) }))
    }
  }

  const createRoom = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const peer = new Peer(`EXCR-${code}`, { debug: 0 })
      peerRef.current = peer
      setWaiting(true)

      peer.on('open', () => {
        setRoomCode(code)
        resolve(code)
      })
      peer.on('connection', (conn) => {
        connRef.current = conn
        conn.on('open',  ()      => { setConnected(true); setWaiting(false) })
        conn.on('data',  onData)
        conn.on('close', ()      => { setConnected(false) })
      })
      peer.on('error', (e) => { setError(e.message); reject(e) })
    })
  }, [])

  const joinRoom = useCallback((code: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const peer = new Peer({ debug: 0 })
      peerRef.current = peer

      peer.on('open', () => {
        const conn = peer.connect(`EXCR-${code.toUpperCase().trim()}`)
        connRef.current = conn
        conn.on('open',  () => { setConnected(true); setRoomCode(code.toUpperCase()); resolve() })
        conn.on('data',  onData)
        conn.on('close', () => { setConnected(false) })
        conn.on('error', reject)
      })
      peer.on('error', (e) => { setError(e.message); reject(e) })
    })
  }, [])

  const broadcast = useCallback((data: Partial<OpponentState>) => {
    try { connRef.current?.send(data) } catch { /* ignore if not connected */ }
  }, [])

  const disconnect = useCallback(() => {
    connRef.current?.close()
    peerRef.current?.destroy()
    peerRef.current = null
    connRef.current = null
    setConnected(false)
    setRoomCode('')
    setWaiting(false)
    setOpponent({ reps: 0, formScore: 0, exercise: 'squat', phase: 'up' })
  }, [])

  return { roomCode, connected, waiting, opponent, error, createRoom, joinRoom, broadcast, disconnect }
}
