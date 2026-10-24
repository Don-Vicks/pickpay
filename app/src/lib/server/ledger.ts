// Reads PickPay state straight from the chain (no database): hub totals, credit batches, claims.
import { getBase58Decoder, getBase64Encoder, type Address, type ReadonlyUint8Array } from '@solana/kit'
import {
  BALE_DISCRIMINATOR,
  CLAIM_DISCRIMINATOR,
  CREDIT_BATCH_DISCRIMINATOR,
  PICKPAY_PROGRAM_ADDRESS,
  fetchAllCollection,
  fetchHub,
  findHubPda,
  getBaleDecoder,
  getClaimDecoder,
  getCreditBatchDecoder,
} from '@/generated/pickpay'
import { findCollectionPda } from '@/lib/pdas'
import { getHubSigner, getSigner, rpc } from './solana'

const b58 = getBase58Decoder()
const b64 = getBase64Encoder()

async function programAccounts<T>(
  discriminator: ReadonlyUint8Array,
  decode: (bytes: ReadonlyUint8Array) => T,
  // Optional filter on the 32-byte address stored right after the discriminator (e.g. Bale.hub).
  firstField?: Address,
) {
  const filters: { memcmp: { offset: bigint; bytes: never; encoding: 'base58' } }[] = [
    { memcmp: { offset: 0n, bytes: b58.decode(discriminator) as never, encoding: 'base58' } },
  ]
  if (firstField) filters.push({ memcmp: { offset: 8n, bytes: firstField as never, encoding: 'base58' } })
  const accounts = await rpc.getProgramAccounts(PICKPAY_PROGRAM_ADDRESS, { encoding: 'base64', filters }).send()
  return accounts.map(({ pubkey, account }) => ({ address: pubkey as Address, ...decode(b64.encode(account.data[0])) }))
}

export async function hubAddress() {
  const [hub] = await findHubPda({ authority: (await getHubSigner()).address })
  return hub
}

export async function actorAddresses() {
  const [hub, recycler, brandA, brandB] = await Promise.all(
    (['hub', 'recycler', 'brandA', 'brandB'] as const).map(async (a) => (await getSigner(a)).address),
  )
  return { hub, recycler, brandA, brandB }
}

export const BRAND_NAMES = { brandA: 'Brand A', brandB: 'Brand B' } as const

/** Everything for the demo hub only: other hubs' accounts on the same program are ignored. */
export async function readLedger() {
  const hub = await hubAddress()
  const [{ data: h }, bales, actors] = await Promise.all([
    fetchHub(rpc, hub),
    programAccounts(BALE_DISCRIMINATOR, (d) => getBaleDecoder().decode(d), hub),
    actorAddresses(),
  ])
  const baleByAddress = new Map(bales.map((b) => [b.address as string, b]))
  const [allBatches, allClaims] = await Promise.all([
    programAccounts(CREDIT_BATCH_DISCRIMINATOR, (d) => getCreditBatchDecoder().decode(d)),
    programAccounts(CLAIM_DISCRIMINATOR, (d) => getClaimDecoder().decode(d)),
  ])
  const batches = allBatches.filter((b) => baleByAddress.has(b.bale))
  const batchByBale = new Map(batches.map((b) => [b.bale as string, b]))
  const brandName = (a: string) => (a === actors.brandA ? BRAND_NAMES.brandA : a === actors.brandB ? BRAND_NAMES.brandB : 'Another brand')

  return {
    hub: {
      address: hub,
      collectedG: Number(h.collectedG),
      shippedG: Number(h.shippedG),
      unshippedG: Number(h.collectedG - h.shippedG),
      unshippedBags: Number(h.collectionCount - h.nextUnbaled),
      collections: Number(h.collectionCount),
      bales: Number(h.baleCount),
    },
    bales: bales
      .map((b) => {
        const batch = batchByBale.get(b.address)
        return {
          address: b.address,
          index: Number(b.index),
          weightG: Number(b.weightG),
          bags: Number(b.endCollection - b.firstCollection),
          createdAt: Number(b.createdAt),
          confirmed: b.intakeConfirmed,
          acceptedG: batch ? Number(batch.acceptedG) : null,
        }
      })
      .sort((x, y) => y.index - x.index),
    batches: batches
      .map((b) => {
        const bale = baleByAddress.get(b.bale)!
        return {
          address: b.address,
          bale: b.bale,
          baleIndex: Number(bale.index),
          bags: Number(bale.endCollection - bale.firstCollection),
          acceptedG: Number(b.acceptedG),
          claimedG: Number(b.claimedG),
          remainingG: Number(b.acceptedG - b.claimedG),
          createdAt: Number(b.createdAt),
          claims: allClaims
            .filter((c) => c.batch === b.address)
            .sort((x, y) => Number(x.index - y.index))
            .map((c) => ({ address: c.address, brand: brandName(c.brand), weightG: Number(c.weightG), createdAt: Number(c.createdAt) })),
        }
      })
      .sort((x, y) => y.baleIndex - x.baleIndex),
  }
}

export type Ledger = Awaited<ReturnType<typeof readLedger>>

/** The hub's most recent paid bags, newest first. */
export async function recentBags(limit = 6) {
  const hub = await hubAddress()
  const { data: h } = await fetchHub(rpc, hub)
  const count = Number(h.collectionCount)
  const indexes = Array.from({ length: Math.min(limit, count) }, (_, i) => count - 1 - i)
  if (indexes.length === 0) return []
  const accounts = await fetchAllCollection(rpc, await Promise.all(indexes.map((i) => findCollectionPda(hub, i))))
  return accounts.map(({ data: c }) => ({
    index: Number(c.index),
    weightG: Number(c.weightG),
    polymer: c.polymer as number,
    contaminationBps: c.contaminationBps,
    amount: Number(c.amount),
    // Naira at the hub's conversion rate (the payout itself is tUSDC).
    ngn: (Number(c.amount) / 1e6) * Number(process.env.NGN_PER_USD ?? 1_550),
    toWallet: c.paidTo !== '11111111111111111111111111111111',
    createdAt: Number(c.createdAt),
  }))
}
