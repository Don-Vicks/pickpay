// POST multipart/form-data { photo: File, weightG: string } → AI grade + payout quote.
// Returns the photo's SHA-256 too: record_collection stores it, and the on-chain PhotoSeal
// rejects a second collection with the same bytes.
import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { GradeRefusedError, gradePhoto, type ImageMediaType } from '@/lib/grade'
import { POLYMER_INDEX, quote } from '@/lib/pricing'
import { dHash, toHex } from '@/lib/server/dhash'
import { findNearDuplicate, savePending } from '@/lib/server/photo-store'
import { signQuote } from '@/lib/server/quote-token'

export const runtime = 'nodejs'

const MEDIA_TYPES: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024
const NGN_PER_USD = Number(process.env.NGN_PER_USD ?? 1_550)

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail(500, 'ANTHROPIC_API_KEY is not set in app/.env.local')

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, 'Expected multipart/form-data with photo and weightG')
  }
  const photo = form.get('photo')
  const weightG = Number(form.get('weightG'))
  if (!(photo instanceof File)) return fail(400, 'photo is required')
  if (!MEDIA_TYPES.includes(photo.type as ImageMediaType)) return fail(415, `photo must be one of ${MEDIA_TYPES.join(', ')}`)
  if (photo.size > MAX_BYTES) return fail(413, 'photo must be 5 MB or smaller')
  if (!Number.isInteger(weightG) || weightG <= 0) return fail(400, 'weightG must be a positive integer (grams)')

  const bytes = Buffer.from(await photo.arrayBuffer())
  const photoHash = createHash('sha256').update(bytes).digest('hex')

  // Reused photo? Checked before grading, so a resubmitted picture never costs an AI call.
  let perceptual: bigint
  try {
    perceptual = await dHash(bytes)
  } catch {
    return fail(415, 'Could not read that image')
  }
  const dup = await findNearDuplicate(perceptual)
  if (dup) {
    return NextResponse.json(
      { error: `This looks like the photo already paid for bag #${dup.collectionIndex}`, duplicateOf: dup },
      { status: 409 },
    )
  }

  try {
    const grade = await gradePhoto(bytes.toString('base64'), photo.type as ImageMediaType)
    if (!grade.isPlastic) return NextResponse.json({ error: 'Not a bag of plastic', grade, photoHash }, { status: 422 })

    const q = quote(grade.polymer, grade.contaminationBps, weightG, NGN_PER_USD)
    const polymerIndex = POLYMER_INDEX[grade.polymer]
    await savePending(photoHash, bytes, photo.type)
    return NextResponse.json({
      grade,
      polymerIndex,
      weightG,
      ngnPerKg: Number(q.koboPerKg) / 100,
      ngnTotal: Number(q.koboTotal) / 100,
      ngnPerUsd: NGN_PER_USD,
      amount: q.amount.toString(), // tUSDC base units, as a string (bigint)
      photoHash,
      // /api/collect pays only what this token says.
      quoteToken: signQuote({ photoHash, dHash: toHex(perceptual), weightG, polymerIndex, contaminationBps: grade.contaminationBps, amount: q.amount.toString() }),
    })
  } catch (e) {
    if (e instanceof GradeRefusedError) return fail(422, e.message)
    if (e instanceof Anthropic.RateLimitError) return fail(429, 'Grading is busy, try again in a moment')
    if (e instanceof Anthropic.AuthenticationError) return fail(500, 'ANTHROPIC_API_KEY was rejected')
    if (e instanceof Anthropic.APIError) return fail(502, `Grading failed (${e.status})`)
    throw e
  }
}
