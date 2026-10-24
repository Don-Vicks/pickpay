// Records the live app scenes as full-resolution video with a visible cursor, and logs where the
// key element is (and when) so the video can draw a highlight box on it.
// Real devnet transactions: Brand A claims 1 kg from bale #1; Brand B is then refused on bale #1.
// No AI calls: the hub scenes only use photos that are already paid, so grading is never reached.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { CURSOR_SCRIPT, startRecording } from './recorder.mjs'

const BASE = process.env.BASE ?? 'http://localhost:3001'
const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'public/clips')
const APP = join(ROOT, '../app')
const VW = 800
const VH = 380
const PAYOUT_TX = process.env.PAYOUT_TX ?? '4mfe7ML9jE7wNfRjbopDQoU1kutLtNcWZqWweuHLJnvQnzaDQg3KQs2vy7nXGyRosGMze3jTuKu4ufwMrkCtydkg'
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--hide-scrollbars', '--force-dark-mode'],
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// ONLY=hub-dup,brand re-records just those scenes and keeps the rest of the manifest.
const ONLY = process.env.ONLY?.split(',')
const want = (id) => !ONLY || ONLY.includes(id)
const MANIFEST = join(OUT, 'manifest.json')
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}
process.on('unhandledRejection', async (e) => {
  console.error(e)
  for (const p of await browser.pages()) await p.screenshot({ path: join(OUT, `_fail-${Date.now()}.png`) }).catch(() => {})
  process.exit(1)
})

async function open(url) {
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2.4 })
  await page.goto(url.startsWith('http') ? url : `${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.evaluate(CURSOR_SCRIPT)
  await page.mouse.move(VW * 0.62, VH * 0.75)
  await sleep(600)
  return page
}

/** Smallest element whose text includes `text` (optionally within `selector`). */
const byText = async (page, text, selector = '*') =>
  (await page.evaluateHandle(
    (t, sel) => {
      const all = [...document.querySelectorAll(sel)].filter((e) => e.innerText?.includes(t) && e.offsetParent !== null)
      return all.sort((a, b) => a.innerText.length - b.innerText.length)[0] ?? null
    },
    text,
    selector,
  )).asElement()

/** Waits up to `ms` for `text` to appear, then returns its element (or null). */
async function waitText(page, text, ms = 20000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms }, text).catch(() => {})
  return byText(page, text)
}

const brandCard = (page, name) =>
  page.evaluateHandle((n) => [...document.querySelectorAll('button')].find((b) => b.querySelector('p')?.innerText === n) ?? null, name).then((h) => h.asElement())

/** The "Claim as …" button on the n-th plastic card (0 = newest bale). */
const claimButton = async (page, n) => {
  const el = (
    await page.evaluateHandle((i) => [...document.querySelectorAll('button')].filter((b) => b.innerText.startsWith('Claim as'))[i] ?? null, n)
  ).asElement()
  if (!el) throw new Error(`no Claim button on card ${n}`)
  return el
}

async function scrollTo(el, block = 'center') {
  await el.evaluate((e, b) => e.scrollIntoView({ block: b, behavior: 'smooth' }), block)
  await sleep(900)
}

async function pointAt(page, el, steps = 22) {
  const box = await el.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps })
  await sleep(150)
}

async function click(page, el) {
  await pointAt(page, el)
  await page.mouse.down()
  await sleep(80)
  await page.mouse.up()
}

function clip(id) {
  const marks = []
  let rec
  return {
    async start(page) {
      rec = await startRecording(page, { width: 1920, height: 912 })
    },
    /** Highlight `el` from now for `dur` seconds. */
    async mark(el, label, { dur = 3, zoom = 1 } = {}) {
      const b = await el.boundingBox()
      if (!b) return
      const pad = 6
      marks.push({
        at: +rec.now().toFixed(2),
        until: +(rec.now() + dur).toFixed(2),
        x: (b.x - pad) / VW,
        y: (b.y - pad) / VH,
        w: (b.width + pad * 2) / VW,
        h: (b.height + pad * 2) / VH,
        label,
        zoom,
      })
    },
    async holdUntil(seconds) {
      while (rec.now() < seconds) await sleep(100)
    },
    async stop() {
      const info = await rec.stop(join(OUT, `${id}.mp4`))
      manifest[id] = { duration: +rec.now().toFixed(2), marks }
      writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1))
      console.log(`clip ${id}: ${info.frames} frames, ${marks.length} highlights`)
    },
  }
}

// ---------- Home ----------
if (want('home')) {
  const page = await open('/')
  const c = clip('home')
  await c.start(page)
  await sleep(1500)
  const how = await byText(page, 'HOW IT WORKS', 'h2')
  await scrollTo(how, 'start')
  for (const name of ['Collection hub', 'Recycler', 'Brand']) {
    const card = await page.evaluateHandle((n) => [...document.querySelectorAll('ol li a')].find((a) => a.innerText.includes(n)), name)
    await pointAt(page, card, 18)
    await c.mark(card, name, { dur: 2.4 })
    await sleep(2400)
  }
  await c.holdUntil(11.5)
  await c.stop()
  await page.close()
}

// ---------- Hub: fill the form (hub-empty + hub-filled) ----------
async function fillHub(c, page, { phone, kg, photo }) {
  const phoneInput = await page.$('input[inputmode="tel"]')
  await click(page, phoneInput)
  await c.mark(phoneInput, "Picker's phone", { dur: 2.2 })
  await page.keyboard.type(phone, { delay: 85 })
  await sleep(500)
  const weight = await page.$('input[placeholder="6.2"]')
  await scrollTo(weight)
  await click(page, weight)
  await c.mark(weight, 'Scale weight', { dur: 2 })
  await page.keyboard.type(kg, { delay: 120 })
  await sleep(500)
  const box = await page.$('label:has(input[type="file"])')
  await scrollTo(box)
  const [chooser] = await Promise.all([page.waitForFileChooser(), click(page, box)])
  await chooser.accept([photo])
  await sleep(700)
  await c.mark(box, 'Photo of the bag', { dur: 2.5 })
}
if (want('hub-fill')) {
  const page = await open('/hub')
  const c = clip('hub-fill')
  await c.start(page)
  await sleep(1200)
  const intro = await byText(page, 'Pay for a bag of plastic', 'h1')
  await c.mark(intro, 'Step 1: the hub', { dur: 3 })
  await sleep(3800) // hub-empty beat is 6 s
  await fillHub(c, page, { phone: '0803 123 4567', kg: '6.2', photo: join(APP, 'demo-photos/video-pet-bales.jpg') })
  await c.holdUntil(15)
  await c.stop()
  await page.close()
}

// ---------- Hub: reused photo blocked ----------
if (want('hub-dup')) {
  const page = await open('/hub')
  const c = clip('hub-dup')
  await c.start(page)
  await sleep(400)
  const phoneInput = await page.$('input[inputmode="tel"]')
  await click(page, phoneInput)
  await page.keyboard.type('0806 555 0101', { delay: 60 })
  const weight = await page.$('input[placeholder="6.2"]')
  await scrollTo(weight)
  await click(page, weight)
  await page.keyboard.type('7', { delay: 60 })
  const box = await page.$('label:has(input[type="file"])')
  await scrollTo(box)
  const [chooser] = await Promise.all([page.waitForFileChooser(), click(page, box)])
  await chooser.accept([join(APP, 'seed-photos/02-hdpe-jerrycans.jpg')])
  await sleep(600)
  const check = await byText(page, 'Check the bag and price it', 'button')
  await scrollTo(check)
  await click(page, check)
  await page.waitForFunction(() => document.body.innerText.includes('already paid for bag'), { timeout: 30000 }).catch(async (e) => {
    await page.screenshot({ path: join(OUT, '_fail-hub-dup.png') })
    throw e
  })
  await sleep(300)
  const err = await byText(page, 'already paid for bag', 'p')
  await scrollTo(err)
  await c.mark(err, 'Blocked: photo already paid', { dur: 5, zoom: 1.35 })
  await c.holdUntil(10.5)
  await c.stop()
  await page.close()
}

// ---------- Explorer: the payout ----------
if (want('payout-explorer')) {
  const page = await open(`https://explorer.solana.com/tx/${PAYOUT_TX}?cluster=devnet`)
  await sleep(5000)
  const c = clip('payout-explorer')
  await c.start(page)
  await sleep(800)
  const status = await waitText(page, 'Success')
  if (status) await c.mark(status, 'Confirmed on Solana', { dur: 3.5, zoom: 1.25 })
  await sleep(3800)
  const sig = await byText(page, 'Signature', 'td')
  if (sig) await c.mark(sig, 'Transaction signature', { dur: 3 })
  await c.holdUntil(8.5)
  await c.stop()
  await page.close()
}

// ---------- Brand B asks for 15 kg from bale #1 (4.9 kg left) and is refused ----------
async function recordBrandB(page) {
  const b = clip('brand-b')
  await b.start(page)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(700)
  const brandB = await brandCard(page, 'Brand B')
  await click(page, brandB)
  await b.mark(brandB, 'Now Brand B', { dur: 1.8 })
  await sleep(500)
  const inputs = await page.$$('input[inputmode="decimal"]')
  const bale2Input = inputs[1] // bale #1, which has 4.9 kg left after Brand A's claim
  await scrollTo(bale2Input)
  await click(page, bale2Input)
  await bale2Input.evaluate((e) => e.select()) // typing then replaces the default "1"
  await page.keyboard.type('15', { delay: 140 })
  await b.mark(bale2Input, '15 kg, but only 4.9 kg is left', { dur: 2.2 })
  await sleep(300)
  const claimB = await claimButton(page, 1)
  await click(page, claimB)
  await page.waitForFunction(() => document.body.innerText.includes('Refused by the blockchain'), { timeout: 60000 })
  await page.waitForFunction(() => !document.body.innerText.includes('Asking the blockchain'), { timeout: 30000 })
  const refused = await byText(page, 'Refused by the blockchain.', 'div')
  await scrollTo(refused)
  await b.mark(refused, 'Refused', { dur: 6, zoom: 1.3 })
  const refusedHref = await page.evaluate(() => [...document.querySelectorAll('a')].find((x) => x.innerText.includes('See the refused attempt'))?.href)
  manifest.refusedTx = refusedHref
  await b.holdUntil(16)
  await b.stop()
}

// ---------- Brand: overview, Brand A claims 1 kg from bale #1 ----------
let traceHref = manifest.traceHref
if (want('brand')) {
  // Guard: the narration says Brand B finds 4.9 kg left, i.e. bale #1 must hold 5.9 kg before Brand A's 1 kg.
  const before = await (await fetch(`${BASE}/api/ledger`)).json()
  const bale1 = before.batches.find((x) => x.baleIndex === 0)
  if (bale1?.remainingG !== 5900) throw new Error(`bale #1 has ${bale1?.remainingG} g left, expected 5900`)
  const page = await open('/brand')
  const c = clip('brand')
  await c.start(page)
  await sleep(1000)
  const avail = await byText(page, '5.9 kg still available', 'span')
  await scrollTo(avail)
  await pointAt(page, avail)
  await c.mark(avail, 'Confirmed by the recycler', { dur: 4 })
  await c.holdUntil(8.5)
  await c.stop()

  const a = clip('brand-a')
  await a.start(page)
  const brandA = await brandCard(page, 'Brand A')
  await click(page, brandA)
  await sleep(300)
  const bale1Claim = await claimButton(page, 1) // second card = bale #1
  await scrollTo(bale1Claim)
  await click(page, bale1Claim)
  await page.waitForFunction(() => document.body.innerText.includes('Brand A claimed 1.0 kg.'), { timeout: 60000 })
  await page.waitForFunction(() => !document.body.innerText.includes('Asking the blockchain'), { timeout: 30000 })
  const ok = await byText(page, 'Brand A claimed 1.0 kg.', 'div')
  await scrollTo(ok)
  await a.mark(ok, 'Claimed. Used up for everyone else', { dur: 4, zoom: 1.3 })
  traceHref = await page.evaluate(() => [...document.querySelectorAll('a')].find((x) => x.innerText.includes('Trace it back'))?.href)
  await a.holdUntil(9.5)
  await a.stop()

  await recordBrandB(page)
  await page.close()
}

if (want('brand-b')) {
  const page = await open('/brand')
  await recordBrandB(page)
  await page.close()
}

// ---------- Explorer: the program's own refusal ----------
if (want('brand') || want('brand-b') || want('refused-log')) {
  const page = await open(manifest.refusedTx)
  await sleep(6000)
  const c = clip('refused-log')
  await c.start(page)
  await sleep(600)
  const err = await waitText(page, 'Error')
  if (err) await c.mark(err, 'Failed on-chain', { dur: 2.5 })
  await sleep(2600)
  const log = await waitText(page, 'AlreadyClaimed')
  if (log) await scrollTo(log)
  if (log) await c.mark(log, 'AlreadyClaimed, Error 6004', { dur: 6, zoom: 1.35 })
  await c.holdUntil(11.5)
  await c.stop()
  await page.close()
}

// ---------- Public ledger: trace Brand A's claim to the bags ----------
if (want('brand') || want('ledger')) {
  const page = await open(new URL(traceHref).pathname)
  const c = clip('ledger')
  await c.start(page)
  await sleep(1200)
  const title = await byText(page, 'Brand A claimed 1.0 kg', 'h1')
  await c.mark(title, "Brand A's claim", { dur: 2.5 })
  await sleep(2600)
  const recyc = await byText(page, 'weighed the bale and confirmed', 'div')
  await scrollTo(recyc)
  await c.mark(recyc, 'Recycler confirmed', { dur: 2.5 })
  await sleep(2700)
  const bags = await byText(page, 'paid for at the hub', 'p')
  await scrollTo(bags, 'start')
  await sleep(1500)
  const match = await byText(page, 'matches the blockchain record', 'p')
  if (match) {
    await scrollTo(match)
    await c.mark(match, 'Photo matches the record', { dur: 4, zoom: 1.3 })
  }
  await c.holdUntil(15.5)
  await c.stop()
  await page.close()
}

manifest.traceHref = traceHref
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1))
console.log(JSON.stringify({ traceHref, refusedTx: manifest.refusedTx }))
await browser.close()
