// POST JSON { quoteToken, phone, wallet? } → record_collection on devnet.
// Pays the picker's wallet in the same transaction, or accrues to their phone-hash balance.
import { NextResponse } from 'next/server'
import { address, isAddress, type Address } from '@solana/kit'
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token'
import {
  fetchHub,
  findEscrowPda,
  findHubPda,
  getRecordCollectionInstructionAsync,
  PICKPAY_PROGRAM_ADDRESS,
} from '@/generated/pickpay'
import { findCollectionPda, findPhotoSealPda, findPickerPda } from '@/lib/pdas'
import { pickerHash } from '@/lib/server/picker'
import { verifyQuote } from '@/lib/server/quote-token'
import { MINT, explorerTx, getHubSigner, rpc, sendTx } from '@/lib/server/solana'

export const runtime = 'nodejs'

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
  let body: { quoteToken?: string; phone?: string; wallet?: string }
  try {
    body = await req.json()
  } catch {
    return fail(400, 'Expected JSON')
  }

  let quote, hash: Uint8Array
  try {
    quote = verifyQuote(body.quoteToken ?? '')
    hash = pickerHash(body.phone ?? '')
  } catch (e) {
    return fail(400, (e as Error).message)
  }
  const wallet = body.wallet?.trim() ? body.wallet.trim() : null
  if (wallet && !isAddress(wallet)) return fail(400, 'Wallet is not a valid Solana address')

  const hubAuthority = await getHubSigner()
  const [hub] = await findHubPda({ authority: hubAuthority.address })
  const [escrow] = await findEscrowPda({ hub })
  const photoHash = Buffer.from(quote.photoHash, 'hex')

  // A photo seal that already exists means this exact photo was paid before.
  const photoSeal = await findPhotoSealPda(photoHash)
  if ((await rpc.getAccountInfo(photoSeal, { encoding: 'base64' }).send()).value) {
    return fail(409, 'This photo was already used for a paid bag')
  }

  const instructions = []
  let pickerToken: Address | undefined
  if (wallet) {
    const owner = address(wallet)
    ;[pickerToken] = await findAssociatedTokenPda({ owner, mint: MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS })
    instructions.push(await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: hubAuthority, owner, mint: MINT }))
  }

  const { data: hubState } = await fetchHub(rpc, hub)
  instructions.push(
    await getRecordCollectionInstructionAsync({
      authority: hubAuthority,
      hub,
      collection: await findCollectionPda(hub, hubState.collectionCount),
      photoSeal,
      picker: await findPickerPda(hub, hash),
      mint: MINT,
      escrow,
      pickerToken,
      pickerHash: hash,
      photoHash,
      weightG: BigInt(quote.weightG),
      polymer: quote.polymerIndex,
      contaminationBps: quote.contaminationBps,
      amount: BigInt(quote.amount),
    }),
  )

  try {
    const started = Date.now()
    const signature = await sendTx(hubAuthority, instructions)
    return NextResponse.json({
      signature,
      explorer: explorerTx(signature),
      confirmedMs: Date.now() - started,
      collectionIndex: hubState.collectionCount.toString(),
      paidTo: wallet ?? null,
      accrued: !wallet,
      amount: quote.amount,
      program: PICKPAY_PROGRAM_ADDRESS,
    })
  } catch (e) {
    console.error('record_collection failed', e)
    return fail(502, `Transaction failed: ${(e as Error).message}`)
  }
}
