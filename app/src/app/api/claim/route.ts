// POST JSON { brand: 'brandA' | 'brandB', batch, weightG } → claim_credits signed by that brand.
// Sent without preflight, so a rejected claim lands on-chain as a failed transaction: the explorer
// link shows the program's own AlreadyClaimed error rather than a server-side check.
import { NextResponse } from 'next/server'
import { isAddress, type Address } from '@solana/kit'
import {
  PICKPAY_ERROR__ALREADY_CLAIMED,
  PICKPAY_ERROR__ZERO_WEIGHT,
  fetchCreditBatch,
  getClaimCreditsInstruction,
} from '@/generated/pickpay'
import { findClaimPda } from '@/lib/pdas'
import { explorerTx, getSigner, rpc, sendTxDetailed } from '@/lib/server/solana'

export const runtime = 'nodejs'

const BRANDS = { brandA: 'Brand A', brandB: 'Brand B' } as const
// The generated client strips error messages from production bundles; mirror programs/pickpay/src/error.rs.
const PROGRAM_ERRORS: Record<number, [string, string]> = {
  [PICKPAY_ERROR__ALREADY_CLAIMED]: ['AlreadyClaimed', 'These credits have already been claimed'],
  [PICKPAY_ERROR__ZERO_WEIGHT]: ['ZeroWeight', 'Weight must be greater than zero'],
}
const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { brand?: string; batch?: string; weightG?: number }
  if (!(body.brand && body.brand in BRANDS)) return fail(400, 'brand must be brandA or brandB')
  if (!(body.batch && isAddress(body.batch))) return fail(400, 'batch must be a credit batch address')
  if (!(Number.isInteger(body.weightG) && body.weightG! > 0)) return fail(400, 'weightG must be a positive integer')

  const brand = await getSigner(body.brand as keyof typeof BRANDS)
  const batch = body.batch as Address
  const { data: b } = await fetchCreditBatch(rpc, batch)

  // No server-side "enough left?" check on purpose: the program is the only gatekeeper.
  const ix = getClaimCreditsInstruction({
    brand,
    creditBatch: batch,
    claim: await findClaimPda(batch, b.claimCount),
    weightG: BigInt(body.weightG!),
  })
  const result = await sendTxDetailed(brand, [ix], { skipPreflight: true })
  const base = { brand: BRANDS[body.brand as keyof typeof BRANDS], weightG: body.weightG, signature: result.signature, explorer: explorerTx(result.signature) }

  if (!result.error) return NextResponse.json({ ok: true, ...base })
  const code = result.error.code
  const [errorName, message] = (code !== null && PROGRAM_ERRORS[code]) || [null, result.error.message]
  return NextResponse.json(
    { ok: false, ...base, errorCode: code, errorName, error: message },
    { status: 409 },
  )
}
