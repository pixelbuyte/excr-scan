import { chromium, webkit, devices } from 'playwright'

// Mirrors the real failing scenario as closely as possible without hardware:
//   PC  = desktop Chromium
//   Phone = WebKit (Safari's actual engine) with an iPhone device profile
// Two separate browser engines, real public Nostr relays. Proves the compete
// data path works on the same engine an iPhone runs — the one gap left after
// the node + Chromium harnesses.

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const log = (...a) => console.log(...a)

const pc    = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
const phone = await webkit.launch({ headless: true })

let ok = false
let host, join
const dumpLogs = async () => {
  for (const [tag, p] of [['PC', host], ['PHONE', join]]) {
    if (!p) continue
    try {
      const lines = await p.locator('.no-scrollbar div').allTextContents()
      log(`--- ${tag} url=${p.url()} connlog: ${lines.join(' | ') || '(empty)'}`)
    } catch (e) { log(`--- ${tag} dump failed: ${e.message}`) }
  }
}
try {
  const pcCtx    = await pc.newContext({ permissions: ['camera'] })
  const phoneCtx = await phone.newContext({ ...devices['iPhone 13'] })  // WebKit: camera grant unsupported; not needed to reach /scan
  host = await pcCtx.newPage()      // PC hosts
  join = await phoneCtx.newPage()   // phone joins
  host.on('pageerror', e => log('[PC error]', e.message))
  join.on('pageerror', e => log('[PHONE(WebKit) error]', e.message))
  host.on('console', m => log('[PC console]', m.text()))
  join.on('console', m => log('[PHONE console]', m.text()))

  await host.goto(`${BASE}/compete`, { waitUntil: 'domcontentloaded' })
  await host.getByText('Create Room', { exact: true }).click()
  await host.waitForFunction(() => {
    const el = document.querySelector('[data-testid="room-code"]')
    return el && el.textContent && el.textContent.trim().length === 6
  }, { timeout: 30000 })
  const code = (await host.locator('[data-testid="room-code"]').textContent()).trim()
  log(`PC host room code: ${code}`)

  await join.goto(`${BASE}/compete`, { waitUntil: 'domcontentloaded' })
  await join.getByText('Join Room', { exact: true }).click()
  await join.locator('input').fill(code)
  await join.getByText('Join', { exact: true }).click()
  log('Phone (WebKit/iPhone) submitted join, waiting for relay link…')

  await Promise.all([
    host.waitForURL(/\/scan/, { timeout: 60000 }),
    join.waitForURL(/\/scan/, { timeout: 60000 }),
  ])
  log('✅ PC (Chromium) + Phone (WebKit/iPhone) both reached /scan over real relays')
  ok = true
} catch (e) {
  log(`❌ FAILED: ${e.message}`)
  await dumpLogs()
} finally {
  await pc.close(); await phone.close()
  log(ok ? 'RESULT: PASS' : 'RESULT: FAIL')
  process.exit(ok ? 0 : 1)
}
