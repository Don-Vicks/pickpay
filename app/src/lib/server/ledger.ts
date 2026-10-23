// Reads PickPay state straight from the chain (no database): hub totals, credit batches, claims.
import { getBase58Decoder, getBase64Encoder, type Address, type ReadonlyUint8Array } from '@solana/kit'
import {
  CLAIM_DISCRIMINATOR,
  CREDIT_BATCH_DISCRIMINATOR,
  PICKPAY_PROGRAM_ADDRESS,
  fetchHub,
  findHubPda,
  getClaimDecoder,
  getCreditBatchDecoder,
} from '@/generated/pickpay'
import { getHubSigner, getSigner, rpc } from './solana'

const b58 = getBase58Decoder()
const b64 = getBase64Encoder()

async function programAccounts<T>(discriminator: ReadonlyUint8Array, decode: (bytes: ReadonlyUint8Array) => T) {
  const accounts = await rpc
    .getProgramAccounts(PICKPAY_PROGRAM_ADDRESS, {
      encoding: 'base64',
      filters: [{ memcmp: { offset: 0n, bytes: b58.decode(discriminator) as never, encoding: 'base58' } }],
    })
    .send()
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

export async function readLedger() {
  const hub = await hubAddress()
  const [{ data: h }, batches, claims, actors] = await Promise.all([
    fetchHub(rpc, hub),
    programAccounts(CREDIT_BATCH_DISCRIMINATOR, (d) => getCreditBatchDecoder().decode(d)),
    programAccounts(CLAIM_DISCRIMINATOR, (d) => getClaimDecoder().decode(d)),
    actorAddresses(),
  ])
  const brandName = (a: string) => (a === actors.brandA ? 'Brand A' : a === actors.brandB ? 'Brand B' : a)

  return {
    hub: {
      address: hub,
      collectedG: Number(h.collectedG),
      shippedG: Number(h.shippedG),
      unshippedG: Number(h.collectedG - h.shippedG),
      collections: Number(h.collectionCount),
      bales: Number(h.baleCount),
    },
    batches: batches
      .map((b) => ({
        address: b.address,
        bale: b.bale,
        acceptedG: Number(b.acceptedG),
        claimedG: Number(b.claimedG),
        remainingG: Number(b.acceptedG - b.claimedG),
        createdAt: Number(b.createdAt),
        claims: claims
          .filter((c) => c.batch === b.address)
          .sort((x, y) => Number(x.index - y.index))
          .map((c) => ({ address: c.address, brand: brandName(c.brand), weightG: Number(c.weightG) })),
      }))
      .sort((x, y) => y.createdAt - x.createdAt),
  }
}
