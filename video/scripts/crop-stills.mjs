// Crops the hub and recycler screenshots to the part that matters, so they read at full size,
// and writes where (and when, in seconds into the scene) each highlight goes.
// Coordinates are pixels in the original screenshots in public/shots.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const sharp = createRequire(join(ROOT, '../app/package.json'))('sharp')
const OUT = join(ROOT, 'public/stills')
mkdirSync(OUT, { recursive: true })

// crop: [left, top, width, height]; marks: [at, until, left, top, width, height, label, zoom] in source pixels.
const STILLS = {
  'hub-graded': {
    src: '04-hub-graded.png',
    crop: [0, 220, 1170, 900],
    marks: [
      [1.2, 4.6, 54, 390, 1060, 70, 'Plastic type', 1],
      [4.4, 7.8, 54, 462, 1060, 120, 'How dirty it is', 1],
      [7.6, 12, 54, 915, 1060, 145, 'The price', 1.25],
    ],
  },
  'hub-paid': {
    src: '05-hub-paid.png',
    crop: [0, 700, 1170, 950],
    marks: [
      [1, 5, 110, 880, 620, 150, 'Paid to the picker', 1],
      [5, 11, 110, 1185, 960, 140, 'On the blockchain in about a second', 1.25],
    ],
  },
  'recycler-bale': {
    src: '08-recycler-bale.png',
    crop: [760, 725, 1360, 575],
    marks: [
      [1, 5.5, 840, 825, 1200, 100, 'What the hub says it sent', 1],
      [5.2, 10, 840, 990, 1210, 110, 'Weigh it and confirm', 1.15],
    ],
  },
  'recycler-ok': {
    src: '09-recycler-confirmed.png',
    crop: [760, 780, 1360, 470],
    marks: [
      [1, 6, 800, 820, 1280, 95, 'Recycling credits created', 1.2],
      [6, 10, 800, 1040, 1280, 92, 'Sent 6.2 kg, confirmed 5.9 kg', 1],
    ],
  },
}

const manifest = {}
for (const [id, s] of Object.entries(STILLS)) {
  const [left, top, width, height] = s.crop
  await sharp(join(ROOT, 'public/shots', s.src)).extract({ left, top, width, height }).toFile(join(OUT, `${id}.png`))
  manifest[id] = {
    width,
    height,
    marks: s.marks.map(([at, until, x, y, w, h, label, zoom]) => ({
      at,
      until,
      x: (x - left) / width,
      y: (y - top) / height,
      w: w / width,
      h: h / height,
      label,
      zoom,
    })),
  }
  console.log(`still ${id}: ${width}x${height}`)
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1))
