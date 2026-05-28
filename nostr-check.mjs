import { SimplePool } from 'nostr-tools/pool'
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure'
import { useWebSocketImplementation } from 'nostr-tools/pool'
import WebSocket from 'ws'
useWebSocketImplementation(WebSocket)
process.on('unhandledRejection', () => {})   // ignore per-relay rate-limit rejects

// Proves the compete transport: two independent clients join the same room tag
// over REAL public Nostr relays and exchange state — no WebRTC, no NAT. This is
// the exact path phone<->PC uses. If both sides see the other's reps, it works
// across any network that allows wss (cellular included).

const RELAYS = [
  'wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social',
  'wss://nostr.wine', 'wss://relay.nostr.band', 'wss://nostr-pub.wellorder.net',
]
const KIND = 20001
const tag = `excr-test-${Math.random().toString(36).slice(2, 8)}`

function client(name) {
  const pool = new SimplePool()
  const sk = generateSecretKey()
  const pk = getPublicKey(sk)
  const got = { reps: -1 }
  const pub = (obj) => {
    const ev = finalizeEvent({ kind: KIND, created_at: Math.floor(Date.now() / 1000),
      tags: [['t', tag]], content: JSON.stringify(obj) }, sk)
    for (const p of pool.publish(RELAYS, ev)) Promise.resolve(p).catch(() => {})
  }
  const sub = pool.subscribeMany(RELAYS,
    { kinds: [KIND], '#t': [tag], since: Math.floor(Date.now() / 1000) - 5 },
    { onevent: (ev) => {
        if (ev.pubkey === pk) return
        try { const d = JSON.parse(ev.content); if (typeof d.reps === 'number' && d.reps > got.reps) {
          got.reps = d.reps; console.log(`[${name}] saw opponent reps=${d.reps}`)
        } } catch {}
      } })
  return { pub, got, stop: () => { sub.close(); pool.close(RELAYS) } }
}

const A = client('HOST')
const B = client('JOIN')

// Each side publishes a rising rep count; the other must observe it.
let n = 0
const tick = setInterval(() => {
  n++
  A.pub({ reps: n, formScore: 90, exercise: 'squat', phase: 'up' })
  B.pub({ reps: n * 10, formScore: 80, exercise: 'squat', phase: 'down' })
}, 3000)

setTimeout(() => {
  clearInterval(tick)
  A.stop(); B.stop()
  const ok = A.got.reps > 0 && B.got.reps > 0   // both saw the other
  console.log(`HOST saw=${A.got.reps}  JOIN saw=${B.got.reps}`)
  console.log(ok ? 'RESULT: PASS — bidirectional state over relays (no NAT, phone<->PC works)'
                 : 'RESULT: FAIL — relays did not carry state both ways')
  process.exit(ok ? 0 : 1)
}, 16000)
