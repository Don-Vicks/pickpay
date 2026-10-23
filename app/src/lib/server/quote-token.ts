// Signed quotes: /api/grade signs the grade and price it computed, and /api/collect pays only a
// quote it signed, so a tampered browser request can't raise the payout or swap the photo.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { hubSecret } from './solana'

export type Quote = {
  photoHash: string // hex SHA-256 of the photo bytes
  dHash: string // hex 64-bit perceptual hash, indexed once the bag is paid
  weightG: number
  polymerIndex: number
  contaminationBps: number
  amount: string // tUSDC base units
  exp: number // unix seconds
}

const TTL_SECONDS = 10 * 60
const key = () => createHash('sha256').update('pickpay-quote:').update(hubSecret()).digest()
const mac = (body: string) => createHmac('sha256', key()).update(body).digest('base64url')

export function signQuote(q: Omit<Quote, 'exp'>): string {
  const body = Buffer.from(JSON.stringify({ ...q, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS })).toString('base64url')
  return `${body}.${mac(body)}`
}

export function verifyQuote(token: string): Quote {
  const [body, sig] = token.split('.')
  if (!body || !sig) throw new Error('Malformed quote')
  const expected = Buffer.from(mac(body))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new Error('Quote signature is invalid')
  const q = JSON.parse(Buffer.from(body, 'base64url').toString()) as Quote
  if (q.exp < Date.now() / 1000) throw new Error('Quote expired, grade the bag again')
  return q
}
