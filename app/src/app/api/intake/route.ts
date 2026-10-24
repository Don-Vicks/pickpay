// POST JSON { bale, acceptedG } → the recycler confirms what arrived from that bale. Signed by the
// recycler; this is the only step that creates recycling credits, capped at the bale's weight.
import { NextResponse } from 'next/server'
import { isAddress, type Address } from '@solana/kit'
import { fetchBale, getConfirmIntakeInstructionAsync } from '@/generated/pickpay'
import { explorerTx, getSigner, rpc, sendTxDetailed } from '@/lib/server/solana'

export const runtime = 'nodejs'

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { bale?: string; acceptedG?: number }
  if (!(body.bale && isAddress(body.bale))) return fail(400, 'bale must be a bale address')
  if (!(Number.isInteger(body.acceptedG) && body.acceptedG! > 0)) return fail(400, 'Enter the weight that arrived, in grams')

  const recycler = await getSigner('recycler')
  const bale = body.bale as Address
  const { data: b } = await fetchBale(rpc, bale)
  if (b.intakeConfirmed) return fail(409, 'This bale was already confirmed')

  // Sent without preflight so an over-weight confirmation is refused by the program on-chain.
  const result = await sendTxDetailed(
    recycler,
    [await getConfirmIntakeInstructionAsync({ recycler, bale, acceptedG: BigInt(body.acceptedG!) })],
    { skipPreflight: true },
  )
  if (result.error) {
    const tooMuch = result.error.code === 6003
    return NextResponse.json(
      {
        error: tooMuch
          ? `Refused by the program: you can't confirm more than the ${(Number(b.weightG) / 1000).toFixed(1)} kg that was shipped`
          : `Transaction failed: ${result.error.message}`,
        explorer: explorerTx(result.signature),
      },
      { status: 409 },
    )
  }
  return NextResponse.json({ bale, acceptedG: body.acceptedG, weightG: Number(b.weightG), explorer: explorerTx(result.signature) })
}
