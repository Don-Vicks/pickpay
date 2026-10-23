// POST JSON { acceptedPct?: number } → the hub ships every unshipped gram as one bale, then the
// recycler signs intake for acceptedPct of it (default 100), which creates the recovery credits.
import { NextResponse } from 'next/server'
import { fetchHub, getConfirmIntakeInstructionAsync, getShipBaleInstructionAsync } from '@/generated/pickpay'
import { findBalePda } from '@/lib/pdas'
import { hubAddress } from '@/lib/server/ledger'
import { explorerTx, getHubSigner, getSigner, rpc, sendTx } from '@/lib/server/solana'

export const runtime = 'nodejs'

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { acceptedPct?: number }
  const acceptedPct = body.acceptedPct ?? 100
  if (!(acceptedPct > 0 && acceptedPct <= 100)) return fail(400, 'acceptedPct must be in (0, 100]')

  const [hubAuthority, recycler, hub] = await Promise.all([getHubSigner(), getSigner('recycler'), hubAddress()])
  const { data: h } = await fetchHub(rpc, hub)
  const weightG = h.collectedG - h.shippedG
  if (weightG <= 0n) return fail(409, 'No unshipped plastic at the hub. Pay some bags first.')

  try {
    const bale = await findBalePda(hub, h.baleCount)
    const shipSig = await sendTx(hubAuthority, [
      await getShipBaleInstructionAsync({ authority: hubAuthority, hub, bale, weightG, recycler: recycler.address }),
    ])
    const acceptedG = (weightG * BigInt(Math.round(acceptedPct * 100))) / 10_000n
    const intakeSig = await sendTx(recycler, [await getConfirmIntakeInstructionAsync({ recycler, bale, acceptedG })])
    return NextResponse.json({
      bale,
      weightG: Number(weightG),
      acceptedG: Number(acceptedG),
      ship: explorerTx(shipSig),
      intake: explorerTx(intakeSig),
    })
  } catch (e) {
    console.error('ship/intake failed', e)
    return fail(502, `Transaction failed: ${(e as Error).message}`)
  }
}
