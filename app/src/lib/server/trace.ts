// Rebuilds a brand claim's provenance from chain state alone:
// claim → credit batch → recycler intake → bale → the individual paid bags.
import { createHash } from 'node:crypto'
import type { Address } from '@solana/kit'
import {
  CLAIM_DISCRIMINATOR,
  PICKPAY_PROGRAM_ADDRESS,
  Polymer,
  fetchAllCollection,
  fetchBale,
  fetchClaim,
  fetchCreditBatch,
} from '@/generated/pickpay'
import { findCollectionPda } from '@/lib/pdas'
import { actorAddresses } from './ledger'
import { readPaidPhoto } from './photo-store'
import { rpc } from './solana'

const SYSTEM_DEFAULT = '11111111111111111111111111111111'
const hex = (b: ArrayLike<number>) => Buffer.from(Uint8Array.from(b)).toString('hex')
const POLYMER: Record<Polymer, string> = { [Polymer.Pet]: 'PET', [Polymer.Hdpe]: 'HDPE', [Polymer.Mixed]: 'Mixed' }

/** True only for a PickPay-owned account carrying the Claim discriminator (the decoder doesn't check it). */
export async function claimExists(claim: Address) {
  const { value } = await rpc.getAccountInfo(claim, { encoding: 'base64' }).send()
  if (!value || value.owner !== PICKPAY_PROGRAM_ADDRESS) return false
  const data = Buffer.from(value.data[0], 'base64')
  return Buffer.from(CLAIM_DISCRIMINATOR).equals(data.subarray(0, CLAIM_DISCRIMINATOR.length))
}

export async function traceClaim(claimAddress: Address) {
  const { data: claim } = await fetchClaim(rpc, claimAddress)
  const { data: batch } = await fetchCreditBatch(rpc, claim.batch)
  const { data: bale } = await fetchBale(rpc, batch.bale)
  const actors = await actorAddresses()
  const name = (a: string) =>
    ({ [actors.brandA]: 'Brand A', [actors.brandB]: 'Brand B', [actors.recycler]: 'Demo recycler' })[a] ?? null

  const indexes = []
  for (let i = bale.firstCollection; i < bale.endCollection; i++) indexes.push(i)
  const addresses = await Promise.all(indexes.map((i) => findCollectionPda(bale.hub, i)))
  const collections = addresses.length ? await fetchAllCollection(rpc, addresses) : []

  const bags = await Promise.all(
    collections.map(async ({ address, data: c }) => {
      const photoHash = hex(c.photoHash)
      const photo = await readPaidPhoto(photoHash)
      return {
        address,
        index: Number(c.index),
        weightG: Number(c.weightG),
        polymer: POLYMER[c.polymer],
        contaminationBps: c.contaminationBps,
        amount: Number(c.amount),
        paidToWallet: c.paidTo === SYSTEM_DEFAULT ? null : c.paidTo,
        pickerHash: hex(c.pickerHash),
        photoHash,
        // The hub's stored photo must hash to what the chain recorded, or it isn't shown as verified.
        photo: photo ? { verified: createHash('sha256').update(photo.bytes).digest('hex') === photoHash } : null,
        createdAt: Number(c.createdAt),
      }
    }),
  )

  return {
    claim: { address: claimAddress, brand: claim.brand, brandName: name(claim.brand), weightG: Number(claim.weightG), createdAt: Number(claim.createdAt) },
    batch: {
      address: claim.batch,
      acceptedG: Number(batch.acceptedG),
      claimedG: Number(batch.claimedG),
      recycler: batch.recycler,
      recyclerName: name(batch.recycler),
      createdAt: Number(batch.createdAt),
    },
    bale: { address: batch.bale, hub: bale.hub, index: Number(bale.index), weightG: Number(bale.weightG), createdAt: Number(bale.createdAt) },
    bags,
    bagsWeightG: bags.reduce((s, b) => s + b.weightG, 0),
    pickersPaid: bags.reduce((s, b) => s + b.amount, 0),
  }
}

export type ClaimTrace = Awaited<ReturnType<typeof traceClaim>>
