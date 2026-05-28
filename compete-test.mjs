import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const log = (...a) => console.log(...a)

// Two SEPARATE browser instances (not just contexts) to better simulate two devices.
// No GL flags — lighter browsers. /scan navigation fires on peer-join (Trystero),
// independent of camera/model, so this isolates the connection path.
const FLAGS = ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--no-sandbox']
const b1 = await chromium.launch({ headless: true, args: FLAGS })
const b2 = await chromium.launch({ headless: true, args: FLAGS })

async function page(b, tag) {
  const ctx = await b.newContext({ permissions: ['camera'] })
  const p = await ctx.newPage()
  p.on('pageerror', e => log(`[${tag} pageerror] ${e.message}`))
  return p
}

let ok = false
try {
  const host = await page(b1, 'HOST')
  const join = await page(b2, 'JOIN')

  await host.goto(`${BASE}/compete`, { waitUntil: 'domcontentloaded' })
  await host.getByText('Create Room', { exact: true }).click()
  await host.waitForFunction(() => {
    const el = document.querySelector('[data-testid="room-code"]')
    return el && el.textContent && el.textContent.trim().length === 6
  }, { timeout: 25000 })
  const code = (await host.locator('[data-testid="room-code"]').textContent()).trim()
  log(`HOST room code: ${code}`)

  await join.goto(`${BASE}/compete`, { waitUntil: 'domcontentloaded' })
  await join.getByText('Join Room', { exact: true }).click()
  await join.locator('input').fill(code)
  await join.getByText('Join', { exact: true }).click()
  log('JOIN submitted, waiting for relay discovery + WebRTC link…')

  await Promise.all([
    host.waitForURL(/\/scan/, { timeout: 60000 }),
    join.waitForURL(/\/scan/, { timeout: 60000 }),
  ])
  log('✅ BOTH peers discovered each other via relay + reached /scan — CONNECTED')
  ok = true
} catch (e) {
  log(`❌ FAILED: ${e.message}`)
} finally {
  await b1.close(); await b2.close()
  log(ok ? 'RESULT: PASS' : 'RESULT: FAIL')
  process.exit(ok ? 0 : 1)
}
