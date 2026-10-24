// Drives the running app through the real demo once and saves screenshots for the video.
// Real transactions on devnet: pays one bag (1 Haiku grading call), claims 1 kg as Brand A,
// and gets Brand B refused. Run with the app at BASE (default http://localhost:3001).
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE ?? 'http://localhost:3001'
const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'public/shots')
const APP = join(ROOT, '../app')
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--force-dark-mode', '--hide-scrollbars'],
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function open(path, { mobile = false } = {}) {
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await page.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true } : { width: 1440, height: 900, deviceScaleFactor: 2 })
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0' })
  await sleep(800)
  return page
}
const shot = async (page, name, opts = {}) => {
  await page.screenshot({ path: join(OUT, `${name}.png`), ...opts })
  console.log('saved', name)
}
const clickText = (page, text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a')].find((b) => b.textContent.includes(t))
    if (!el) throw new Error(`no button: ${t}`)
    el.click()
  }, text)
const waitText = (page, text, timeout = 60000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text)

// 1. Home
let page = await open('/')
await shot(page, '01-home')
await shot(page, '01-home-full', { fullPage: true })

// 2. Hub: fill, grade (live Haiku call), pay (live devnet tx)
page = await open('/hub', { mobile: true })
await shot(page, '02-hub-empty')
await page.type('input[inputmode="tel"]', '0803 123 4567')
await page.type('input[placeholder="6.2"]', '6.2')
const file = await page.$('input[type="file"]')
await file.uploadFile(join(APP, 'demo-photos/video-pet-bales.jpg'))
await sleep(700)
await shot(page, '03-hub-filled')
await clickText(page, 'Check the bag and price it')
await waitText(page, 'per kg ×')
await sleep(400)
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await sleep(400)
await shot(page, '04-hub-graded')
await clickText(page, 'Pay the picker')
await waitText(page, 'Recorded on the blockchain')
await page.evaluate(() => window.scrollTo(0, 0))
await sleep(400)
await shot(page, '05-hub-paid')
const payTx = await page.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.textContent.includes('See the record'))?.href)

// 3. Reused photo is blocked before any AI call
await clickText(page, 'Next bag')
await sleep(400)
await page.type('input[inputmode="tel"]', '0806 555 0101')
await page.type('input[placeholder="6.2"]', '7')
await (await page.$('input[type="file"]')).uploadFile(join(APP, 'seed-photos/02-hdpe-jerrycans.jpg'))
await sleep(500)
await clickText(page, 'Check the bag and price it')
await waitText(page, 'already paid for bag')
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await sleep(400)
await shot(page, '06-hub-duplicate')

// 4. Recycler (ship the new bag so step 2 shows a bale waiting, then confirm it)
page = await open('/recycler')
await shot(page, '07-recycler-waiting')
await clickText(page, 'Hub sends')
await waitText(page, 'Now weigh it below')
await sleep(500)
await shot(page, '08-recycler-bale')
await clickText(page, 'Confirm')
await waitText(page, 'Brands can now claim it')
await sleep(500)
await shot(page, '09-recycler-confirmed')

// 5. Brand: A claims 1 kg, B asks for 15 kg and is refused
page = await open('/brand')
await shot(page, '10-brand')
await clickText(page, 'Claim as Brand A')
await waitText(page, 'Brand A claimed 1.0 kg')
await sleep(500)
const traceHref = await page.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Trace it back'))?.href)
await shot(page, '11-brand-a-claimed', { fullPage: true })
await clickText(page, 'Brand B')
await sleep(300)
await page.evaluate(() => {
  const input = [...document.querySelectorAll('input')].find((i) => i.value === '1')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(input, '15')
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(300)
await clickText(page, 'Claim as Brand B')
await waitText(page, 'Refused by the blockchain')
await sleep(500)
await shot(page, '12-brand-b-refused', { fullPage: true })
const refusedTx = await page.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.textContent.includes('See the refused attempt'))?.href)

// 6. Ledger trace for the new claim
page = await open(new URL(traceHref).pathname)
await shot(page, '13-ledger-trace')
await shot(page, '13-ledger-trace-full', { fullPage: true })

// 7. Explorer pages: the payout and the refused claim
for (const [name, url] of [['14-explorer-payout', payTx], ['15-explorer-refused', refusedTx]]) {
  const p = await browser.newPage()
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(6000)
  await shot(p, name)
  await shot(p, `${name}-full`, { fullPage: true })
}

// 8. Crops used in the video: the refused claim's result box and the program log on the explorer.
const sharp = createRequire(join(APP, 'package.json'))('sharp')
await sharp(join(OUT, '12-brand-b-refused.png')).extract({ left: 780, top: 1790, width: 1320, height: 470 }).toFile(join(OUT, '12b-refused-result.png'))
await sharp(join(OUT, '15-explorer-refused-full.png')).extract({ left: 1440, top: 2940, width: 1420, height: 550 }).toFile(join(OUT, '16-explorer-refused-logs.png'))
// The crop offsets match the layout at capture time; check both crops after a re-run.

console.log(JSON.stringify({ payTx, refusedTx, traceHref }, null, 1))
await browser.close()
