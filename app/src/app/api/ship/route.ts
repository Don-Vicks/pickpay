// POST → the hub ships every gram it has collected but not yet shipped, as one bale addressed to
// the demo recycler. Signed by the hub. Returns the new bale.
import { NextResponse } from 'next/server'
import { fetchHub, getShipBaleInstructionAsync } from '@/generated/pickpay'
import { findBalePda } from '@/lib/pdas'
import { hubAddress } from '@/lib/server/ledger'
import { explorerTx, getHubSigner, getSigner, rpc, sendTx } from '@/lib/server/solana'

export const runtime = 'nodejs'

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

export async function POST() {
  const [hubAuthority, recycler, hub] = await Promise.all([getHubSigner(), getSigner('recycler'), hubAddress()])
  const { data: h } = await fetchHub(rpc, hub)
  const weightG = h.collectedG - h.shippedG
  if (weightG <= 0n) return fail(409, 'Nothing to ship yet. Pay for some bags at the hub first.')

  try {
    const bale = await findBalePda(hub, h.baleCount)
    const signature = await sendTx(hubAuthority, [
      await getShipBaleInstructionAsync({ authority: hubAuthority, hub, bale, weightG, recycler: recycler.address }),
    ])
    return NextResponse.json({
      bale,
      baleIndex: Number(h.baleCount),
      weightG: Number(weightG),
      bags: Number(h.collectionCount - h.nextUnbaled),
      explorer: explorerTx(signature),
    })
  } catch (e) {
    console.error('ship_bale failed', e)
    return fail(502, `Transaction failed: ${(e as Error).message}`)
  }
}
