// GET a paid bag's photo by its SHA-256 (the hash stored on-chain in the Collection account).
import { readPaidPhoto } from '@/lib/server/photo-store'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ sha: string }> }) {
  const photo = await readPaidPhoto((await params).sha)
  if (!photo) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(photo.bytes), {
    headers: { 'content-type': photo.mediaType, 'cache-control': 'public, max-age=31536000, immutable' },
  })
}
