import { chromium } from 'playwright'

// Extends compete-test: also exercises the new match lifecycle.
//  - JOINER enters via deep LINK (/compete?room=CODE) → proves auto-join + share-link.
//  - After both reach /scan, both must show the synced "GET READY" countdown
//    (proves the host's round control message reached the joiner).
//  - Countdown must auto-flip to live (overlay disappears) within ~8s.
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const log = (...a) => console.log(...a)

const FLAGS = ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']
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

  // Joiner enters via DEEP LINK (auto-join path)
  await join.goto(`${BASE}/compete?room=${code}`, { waitUntil: 'domcontentloaded' })
  log('JOIN opened deep link /compete?room=… (auto-join)')

  await Promise.all([
    host.waitForURL(/\/scan/, { timeout: 60000 }),
    join.waitForURL(/\/scan/, { timeout: 60000 }),
  ])
  log('✅ both reached /scan via link')

  // Both must show the synced countdown
  await Promise.all([
    host.getByText('GET READY', { exact: true }).waitFor({ timeout: 15000 }),
    join.getByText('GET READY', { exact: true }).waitFor({ timeout: 15000 }),
  ])
  log('✅ both show synced GET READY countdown (round control message delivered)')

  // Countdown must auto-flip to live (overlay gone)
  await Promise.all([
    host.getByText('GET READY', { exact: true }).waitFor({ state: 'detached', timeout: 9000 }),
    join.getByText('GET READY', { exact: true }).waitFor({ state: 'detached', timeout: 9000 }),
  ])
  log('✅ countdown auto-advanced to live on both')
  ok = true
} catch (e) {
  log(`❌ FAILED: ${e.message}`)
} finally {
  await b1.close(); await b2.close()
  log(ok ? 'RESULT: PASS' : 'RESULT: FAIL')
  process.exit(ok ? 0 : 1)
}
