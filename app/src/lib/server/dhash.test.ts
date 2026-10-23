import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { NEAR_DUPLICATE_BITS, dHash, hammingDistance } from './dhash.ts'

// A synthetic "bag photo": a gradient with a few shapes, so it has real structure to hash.
async function scene(seed: number, width = 800, height = 600) {
  const shapes = Array.from({ length: 6 }, (_, i) => {
    const x = (seed * 97 + i * 131) % (width - 120)
    const y = (seed * 53 + i * 89) % (height - 120)
    const r = 40 + ((seed + i * 17) % 60)
    return `<circle cx="${x + 60}" cy="${y + 60}" r="${r}" fill="hsl(${(seed * 40 + i * 50) % 360},70%,${30 + i * 8}%)"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#204"/><stop offset="1" stop-color="#9cf"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${shapes}</svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer()
}

test('a resized, recompressed, brightened copy is a near-duplicate', async () => {
  const original = await scene(1)
  const copy = await sharp(original).resize(400).modulate({ brightness: 1.08 }).jpeg({ quality: 55 }).toBuffer()
  const d = hammingDistance(await dHash(original), await dHash(copy))
  assert.ok(d <= NEAR_DUPLICATE_BITS, `distance ${d}`)
})

test('a PNG re-save of the same photo is a near-duplicate', async () => {
  const original = await scene(2)
  const png = await sharp(original).png().toBuffer()
  assert.ok(hammingDistance(await dHash(original), await dHash(png)) <= NEAR_DUPLICATE_BITS)
})

test('different photos are far apart', async () => {
  const [a, b] = await Promise.all([dHash(await scene(3)), dHash(await scene(7))])
  const d = hammingDistance(a, b)
  assert.ok(d > NEAR_DUPLICATE_BITS, `distance ${d}`)
})

test('hammingDistance counts differing bits', () => {
  assert.equal(hammingDistance(0b1011n, 0b0001n), 2)
  assert.equal(hammingDistance(0n, (1n << 64n) - 1n), 64)
})
