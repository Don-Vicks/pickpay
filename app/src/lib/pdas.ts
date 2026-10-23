// PDAs whose seeds the generated client can't derive on its own (they use instruction args or
// account counters). Seeds mirror programs/pickpay/src/constants.rs.
import {
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  getUtf8Encoder,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/kit'
import { PICKPAY_PROGRAM_ADDRESS } from '../generated/pickpay'

const utf8 = getUtf8Encoder()
const addr = getAddressEncoder()
const u64 = getU64Encoder()

async function pda(seeds: ReadonlyUint8Array[]): Promise<Address> {
  const [address] = await getProgramDerivedAddress({ programAddress: PICKPAY_PROGRAM_ADDRESS, seeds })
  return address
}

export const findCollectionPda = (hub: Address, index: bigint | number) =>
  pda([utf8.encode('collection'), addr.encode(hub), u64.encode(index)])

export const findPhotoSealPda = (photoHash: ReadonlyUint8Array) => pda([utf8.encode('photo'), photoHash])

export const findPickerPda = (hub: Address, pickerHash: ReadonlyUint8Array) =>
  pda([utf8.encode('picker'), addr.encode(hub), pickerHash])

export const findBalePda = (hub: Address, index: bigint | number) =>
  pda([utf8.encode('bale'), addr.encode(hub), u64.encode(index)])

export const findClaimPda = (creditBatch: Address, index: bigint | number) =>
  pda([utf8.encode('claim'), addr.encode(creditBatch), u64.encode(index)])
