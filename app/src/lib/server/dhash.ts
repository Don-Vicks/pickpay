// Perceptual "difference hash": catches the same photo re-sent after resizing, recompression or a
// brightness tweak, which the exact SHA-256 PhotoSeal on-chain can't. 64 bits: each bit says whether
// a pixel is brighter than its right-hand neighbour in a 9×8 greyscale thumbnail.
import sharp from 'sharp'

export async function dHash(image: Buffer | Uint8Array): Promise<bigint> {
  const pixels = await sharp(image)
    .rotate() // respect EXIF orientation, so a phone photo and its re-saved copy agree
    .greyscale()
    .resize(9, 8, { fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer()
  let hash = 0n
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      hash = (hash << 1n) | (pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? 1n : 0n)
    }
  }
  return hash
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b
  let n = 0
  while (x) {
    n += Number(x & 1n)
    x >>= 1n
  }
  return n
}

/** At or below this many differing bits (of 64), two photos are treated as the same picture. */
export const NEAR_DUPLICATE_BITS = 10

export const toHex = (h: bigint) => h.toString(16).padStart(16, '0')
export const fromHex = (s: string) => BigInt(`0x${s}`)
