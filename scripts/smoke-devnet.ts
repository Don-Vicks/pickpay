// Devnet smoke test through the generated client: init the demo hub (once), move the hub's
// tUSDC float into its escrow, then record one bag paid straight to the picker's wallet.
// Needs `pnpm setup:devnet` first.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from '@solana/kit'
import { getTransferCheckedInstruction } from '@solana-program/token'
import {
  Polymer,
  fetchHub,
  fetchMaybeHub,
  findEscrowPda,
  findHubPda,
  getInitHubInstructionAsync,
  getRecordCollectionInstructionAsync,
} from '../app/src/generated/pickpay/index.ts'
import { findCollectionPda, findPhotoSealPda, findPickerPda } from '../app/src/lib/pdas.ts'

const ROOT = new URL('..', import.meta.url).pathname
const cfg = JSON.parse(readFileSync(join(ROOT, 'scripts/devnet.json'), 'utf8'))
const rpc = createSolanaRpc(cfg.rpc)
const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions: createSolanaRpcSubscriptions(cfg.rpc.replace('https', 'wss')),
})
const key = (name: string) =>
  createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(readFileSync(join(ROOT, '.keys', `${name}.json`), 'utf8'))))
const sha256 = (s: string) => new Uint8Array(createHash('sha256').update(s).digest())
const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`

async function send(payer: KeyPairSigner, instructions: Instruction[]): Promise<string> {
  const { value: blockhash } = await rpc.getLatestBlockhash().send()
  const tx = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(payer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    ),
  )
  // @ts-expect-error kit's sendable-transaction brand is not inferred through pipe
  await sendAndConfirm(tx, { commitment: 'confirmed' })
  return getSignatureFromTransaction(tx)
}

async function main() {
  const hubAuthority = await key('hub')
  const mint = cfg.mint as Address
  const [hub] = await findHubPda({ authority: hubAuthority.address })
  const [escrow] = await findEscrowPda({ hub })

  if (!(await fetchMaybeHub(rpc, hub)).exists) {
    const ix = await getInitHubInstructionAsync({ authority: hubAuthority, mint, escrow })
    console.log('init_hub', explorer(await send(hubAuthority, [ix])))
  } else console.log('hub exists', hub)

  // Move the float from the hub operator's own ATA into the program escrow.
  const hubAta = cfg.actors.hub.ata as Address
  const { value: float } = await rpc.getTokenAccountBalance(hubAta).send()
  if (BigInt(float.amount) > 0n) {
    const ix = getTransferCheckedInstruction({
      source: hubAta,
      mint,
      destination: escrow,
      authority: hubAuthority,
      amount: BigInt(float.amount),
      decimals: cfg.decimals,
    })
    console.log(`moved ${float.uiAmountString} tUSDC to escrow`, explorer(await send(hubAuthority, [ix])))
  }

  const { data: before } = await fetchHub(rpc, hub)
  const pickerHash = sha256(`pickpay-demo-salt:+2348000000001`)
  const photoHash = sha256(`smoke-photo-${Date.now()}`) // fresh each run; a real photo hash repeats only on reuse
  const pickerAta = cfg.actors.picker.ata as Address
  const ix = await getRecordCollectionInstructionAsync({
    authority: hubAuthority,
    hub,
    collection: await findCollectionPda(hub, before.collectionCount),
    photoSeal: await findPhotoSealPda(photoHash),
    picker: await findPickerPda(hub, pickerHash),
    mint,
    escrow,
    pickerToken: pickerAta,
    pickerHash,
    photoHash,
    weightG: 6_200n,
    polymer: Polymer.Pet,
    contaminationBps: 600,
    amount: 1_550_000n,
  })
  console.log('record_collection', explorer(await send(hubAuthority, [ix])))

  const { data: after } = await fetchHub(rpc, hub)
  const { value: pickerBal } = await rpc.getTokenAccountBalance(pickerAta).send()
  const { value: escrowBal } = await rpc.getTokenAccountBalance(escrow).send()
  console.log({
    hub,
    escrow,
    collections: after.collectionCount,
    collectedG: after.collectedG,
    paidTotal: after.paidTotal,
    pickerBalance: pickerBal.uiAmountString,
    escrowBalance: escrowBal.uiAmountString,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
