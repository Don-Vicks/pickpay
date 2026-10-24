// Replays the demo on devnet through the running app, so every step takes the real path:
// grade each photo in app/seed-photos (Claude vision) → pay the bag → ship and confirm intake →
// Brand A retires part of the credits, leaving the rest for the live double-claim moment.
//
//   pnpm seed:demo                        # app running at http://localhost:3000
//   pnpm seed:demo --base http://localhost:3123 --dry-run
//
// Optional app/seed-photos/manifest.json: [{ "file": "bag-01.jpg", "weightKg": 6.2, "phone": "0803…", "wallet": "…" }]
// Photos not in the manifest get a deterministic weight and one of four demo pickers.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { parseArgs } from 'node:util'

const ROOT = new URL('..', import.meta.url).pathname
const PHOTOS = join(ROOT, 'app/seed-photos')
const MEDIA: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

const { values: opts } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:3000' },
    'dry-run': { type: 'boolean', default: false },
    'no-claim': { type: 'boolean', default: false },
    'accepted-pct': { type: 'string', default: '95' },
    'claim-pct': { type: 'string', default: '60' },
  },
})
const base = opts.base!.replace(/\/$/, '')

type Plan = { file: string; weightG: number; phone: string; wallet?: string }
type Manifest = { file: string; weightKg?: number; phone?: string; wallet?: string }[]

const devnet = JSON.parse(readFileSync(join(ROOT, 'scripts/devnet.json'), 'utf8'))
// Four demo pickers; the first has a wallet so the demo shows both payout paths.
const PICKERS = [
  { phone: '0803 123 4567', wallet: devnet.actors.picker.address as string },
  { phone: '0806 555 0101' },
  { phone: '0812 777 0202' },
  { phone: '0907 300 0303' },
]

function plan(): Plan[] {
  if (!existsSync(PHOTOS)) throw new Error(`No ${PHOTOS} folder. Add bag photos there first.`)
  const manifest: Manifest = existsSync(join(PHOTOS, 'manifest.json'))
    ? JSON.parse(readFileSync(join(PHOTOS, 'manifest.json'), 'utf8'))
    : []
  const files = readdirSync(PHOTOS)
    .filter((f) => MEDIA[extname(f).toLowerCase()])
    .sort()
  return files.map((file, i) => {
    const m = manifest.find((e) => e.file === file)
    const picker = PICKERS[i % PICKERS.length]
    // 3.0–9.4 kg, stable per position, so a replay quotes the same weights.
    const weightG = Math.round((m?.weightKg ?? 3 + ((i * 37) % 65) / 10) * 1000)
    return { file, weightG, phone: m?.phone ?? picker.phone, wallet: m?.wallet ?? picker.wallet }
  })
}

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T & { error?: string } }> {
  const res = await fetch(`${base}${path}`, init).catch(() => {
    throw new Error(`Can't reach the app at ${base}. Start it with: cd app && pnpm dev  (or pass --base)`)
  })
  return { status: res.status, body: await res.json() }
}

const kg = (g: number) => `${(g / 1000).toFixed(1)} kg`

async function main() {
  const bags = plan()
  if (bags.length === 0) throw new Error(`No photos in ${PHOTOS} (jpg, png or webp).`)
  console.log(`${bags.length} photos in app/seed-photos → ${base}${opts['dry-run'] ? ' (dry run)' : ''}`)
  for (const b of bags) console.log(`  ${b.file.padEnd(24)} ${kg(b.weightG).padStart(7)}  ${b.phone}${b.wallet ? '  wallet' : ''}`)
  if (opts['dry-run']) return

  let paid = 0
  for (const b of bags) {
    const form = new FormData()
    form.set('photo', new Blob([readFileSync(join(PHOTOS, b.file))], { type: MEDIA[extname(b.file).toLowerCase()] }), b.file)
    form.set('weightG', String(b.weightG))
    const graded = await api<{ quoteToken: string; ngnTotal: number; grade: { polymer: string; contaminationBps: number } }>(
      '/api/grade',
      { method: 'POST', body: form },
    )
    if (graded.status === 409) {
      console.log(`  skip ${b.file}: ${graded.body.error}`)
      continue
    }
    if (graded.status === 422) {
      console.log(`  skip ${b.file}: ${graded.body.error}`)
      continue
    }
    if (graded.status !== 200) throw new Error(`Grading ${b.file} failed (${graded.status}): ${graded.body.error}`)

    const { grade, ngnTotal, quoteToken } = graded.body
    const collected = await api<{ explorer: string; collectionIndex: string; confirmedMs: number }>('/api/collect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quoteToken, phone: b.phone, wallet: b.wallet }),
    })
    if (collected.status !== 200) throw new Error(`Paying ${b.file} failed (${collected.status}): ${collected.body.error}`)
    paid++
    console.log(
      `  bag #${collected.body.collectionIndex} ${b.file}: ${grade.polymer.toUpperCase()} ${grade.contaminationBps / 100}% → ₦${ngnTotal} in ${collected.body.confirmedMs} ms`,
    )
  }
  if (paid === 0) {
    console.log('Nothing new was paid, so no bale to ship.')
    return
  }

  const intake = await api<{ weightG: number; acceptedG: number; bale: string }>('/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ acceptedPct: Number(opts['accepted-pct']) }),
  })
  if (intake.status !== 200) throw new Error(`Intake failed (${intake.status}): ${intake.body.error}`)
  console.log(`Bale ${intake.body.bale}: shipped ${kg(intake.body.weightG)}, recycler accepted ${kg(intake.body.acceptedG)}`)
  if (opts['no-claim']) return

  const ledger = await api<{ batches: { address: string; bale: string }[] }>('/api/ledger')
  const batch = ledger.body.batches.find((x) => x.bale === intake.body.bale)
  if (!batch) throw new Error('New credit batch not found on the ledger')
  const claimG = Math.floor((intake.body.acceptedG * Number(opts['claim-pct'])) / 100)
  const claim = await api<{ ok: boolean; claim?: string; explorer: string }>('/api/claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ brand: 'brandA', batch: batch.address, weightG: claimG }),
  })
  if (!claim.body.ok) throw new Error(`Brand A claim failed: ${claim.body.error}`)

  const left = intake.body.acceptedG - claimG
  console.log(`Brand A retired ${kg(claimG)}; ${kg(left)} left in batch ${batch.address}`)
  console.log('\nDemo ready:')
  console.log(`  hub         ${base}/hub`)
  console.log(`  brand       ${base}/brand   (claim more than ${kg(left)} as Brand B → AlreadyClaimed)`)
  console.log(`  ledger      ${base}/ledger/${claim.body.claim}`)
}

main().catch((e) => {
  console.error(`\n${(e as Error).message}`)
  process.exit(1)
})
