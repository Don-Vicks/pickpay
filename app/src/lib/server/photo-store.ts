// The hub's photo store. Paid bags' photos and their perceptual hashes live on the hub (app/.data/);
// the chain holds each photo's SHA-256, so anyone can check a published photo against its bag.
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NEAR_DUPLICATE_BITS, fromHex, hammingDistance, toHex } from './dhash'

const ROOT = process.env.PHOTO_DIR ?? join(process.cwd(), '.data')
const PENDING = join(ROOT, 'pending')
const BAGS = join(ROOT, 'bags')
const INDEX = join(ROOT, 'photo-index.json')

export type IndexedPhoto = { sha256: string; dHash: string; collectionIndex: string; mediaType: string; at: string }

const isSha = (s: string) => /^[0-9a-f]{64}$/.test(s)

async function readIndex(): Promise<IndexedPhoto[]> {
  return existsSync(INDEX) ? JSON.parse(await readFile(INDEX, 'utf8')) : []
}

/** The closest already-paid photo within NEAR_DUPLICATE_BITS, if any. */
export async function findNearDuplicate(hash: bigint): Promise<(IndexedPhoto & { distance: number }) | null> {
  let best: (IndexedPhoto & { distance: number }) | null = null
  for (const p of await readIndex()) {
    const distance = hammingDistance(hash, fromHex(p.dHash))
    if (distance <= NEAR_DUPLICATE_BITS && (!best || distance < best.distance)) best = { ...p, distance }
  }
  return best
}

/** Holds a graded photo until its bag is paid. */
export async function savePending(sha256: string, bytes: Buffer, mediaType: string) {
  if (!isSha(sha256)) throw new Error('bad sha256')
  await mkdir(PENDING, { recursive: true })
  await writeFile(join(PENDING, sha256), bytes)
  await writeFile(join(PENDING, `${sha256}.type`), mediaType)
}

/** After record_collection lands: keep the photo and index its perceptual hash. */
export async function commitPaid(sha256: string, hash: bigint, collectionIndex: string) {
  if (!isSha(sha256)) throw new Error('bad sha256')
  await mkdir(BAGS, { recursive: true })
  let mediaType = 'image/jpeg'
  if (existsSync(join(PENDING, sha256))) {
    mediaType = await readFile(join(PENDING, `${sha256}.type`), 'utf8').catch(() => mediaType)
    await rename(join(PENDING, sha256), join(BAGS, sha256))
  }
  const index = await readIndex()
  if (!index.some((p) => p.sha256 === sha256)) {
    index.push({ sha256, dHash: toHex(hash), collectionIndex, mediaType, at: new Date().toISOString() })
    await writeFile(INDEX, JSON.stringify(index, null, 2))
  }
}

export async function readPaidPhoto(sha256: string): Promise<{ bytes: Buffer; mediaType: string } | null> {
  if (!isSha(sha256) || !existsSync(join(BAGS, sha256))) return null
  const entry = (await readIndex()).find((p) => p.sha256 === sha256)
  return { bytes: await readFile(join(BAGS, sha256)), mediaType: entry?.mediaType ?? 'image/jpeg' }
}
