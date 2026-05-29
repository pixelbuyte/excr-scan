import { chromium } from 'playwright'

// Force relay-only WebRTC and probe candidate free TURN servers to find one that
// actually relays a data channel RIGHT NOW. Whatever PASSes here is what the app
// must use so phone-on-cellular <-> PC-on-WiFi (different NATs => must relay) links.

const CANDIDATES = {
  'metered (user key)': [
    { urls: 'turn:global.relay.metered.ca:80', username: '7c7b35f393b14fb5c4da85f2', credential: 'aRHWgTv9TfjeqV8d' },
    { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '7c7b35f393b14fb5c4da85f2', credential: 'aRHWgTv9TfjeqV8d' },
    { urls: 'turn:global.relay.metered.ca:443', username: '7c7b35f393b14fb5c4da85f2', credential: 'aRHWgTv9TfjeqV8d' },
    { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '7c7b35f393b14fb5c4da85f2', credential: 'aRHWgTv9TfjeqV8d' },
  ],
  'openrelay:80/443/tcp': [
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  'freestun.net': [
    { urls: 'turn:freestun.net:3478', username: 'free', credential: 'free' },
    { urls: 'turns:freestun.net:5350', username: 'free', credential: 'free' },
  ],
  'relay.metered (a.relay)': [
    { urls: 'turn:a.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:a.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:a.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  'expressturn': [
    { urls: 'turn:relay1.expressturn.com:3478', username: 'ef9TUWXJ3GS3PNQR3M', credential: 'sWdgY4w2Gsm4q1xX' },
  ],
}

const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] })

async function probe(iceServers) {
  const page = await (await b.newContext()).newPage()
  const ice = { iceTransportPolicy: 'relay', iceServers }
  let sawRelay = false
  page.on('console', m => { if (m.text().includes('relay')) sawRelay = true })
  const ok = await page.evaluate(async (ice) => {
    return await new Promise((resolve) => {
      const a = new RTCPeerConnection(ice)
      const z = new RTCPeerConnection(ice)
      let done = false
      const fin = v => { if (!done) { done = true; resolve(v) } }
      a.onicecandidate = e => { if (e.candidate) { if (e.candidate.type === 'relay') console.log('A relay'); z.addIceCandidate(e.candidate).catch(()=>{}) } }
      z.onicecandidate = e => { if (e.candidate) { if (e.candidate.type === 'relay') console.log('Z relay'); a.addIceCandidate(e.candidate).catch(()=>{}) } }
      const dc = a.createDataChannel('probe')
      dc.onopen = () => fin(true)
      z.ondatachannel = ev => { ev.channel.onmessage = () => {} }
      ;(async () => {
        const o = await a.createOffer(); await a.setLocalDescription(o); await z.setRemoteDescription(o)
        const an = await z.createAnswer(); await z.setLocalDescription(an); await a.setRemoteDescription(an)
      })()
      setTimeout(() => fin(false), 15000)
    })
  }, ice).catch(() => false)
  await page.close()
  return { ok, sawRelay }
}

for (const [name, servers] of Object.entries(CANDIDATES)) {
  const { ok, sawRelay } = await probe(servers)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (relay candidate seen: ${sawRelay})`)
}
await b.close()
