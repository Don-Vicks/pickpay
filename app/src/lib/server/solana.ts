// Server-only Solana access for the hub: RPC, the hub operator's signer, and a send helper.
// The demo hub signs on the server (a custodial hub device); keys never reach the browser.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  isSolanaError,
  pipe,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from '@solana/kit'

// Defaults point at the repo's devnet setup (scripts/devnet.json, .keys/); env overrides for deploys.
const REPO = join(process.cwd(), '..')
const devnet = JSON.parse(readFileSync(process.env.DEVNET_CONFIG ?? join(REPO, 'scripts/devnet.json'), 'utf8'))

export const RPC_URL: string = process.env.SOLANA_RPC_URL ?? devnet.rpc
export const MINT = (process.env.PAYOUT_MINT ?? devnet.mint) as Address
export const MINT_DECIMALS: number = devnet.decimals ?? 6
export const CLUSTER = 'devnet'

export const rpc = createSolanaRpc(RPC_URL)
const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions: createSolanaRpcSubscriptions(process.env.SOLANA_WS_URL ?? RPC_URL.replace('https', 'wss')),
})

function keypairBytes(envVar: string, file: string): Uint8Array {
  const raw = process.env[envVar] ?? readFileSync(join(REPO, '.keys', file), 'utf8')
  return new Uint8Array(JSON.parse(raw))
}

/** Demo actors whose keys the server holds (custodial demo wallets). */
export type Actor = 'hub' | 'recycler' | 'brandA' | 'brandB'
const signers = new Map<Actor, Promise<KeyPairSigner>>()
/** An actor's key: `<ACTOR>_KEYPAIR` (JSON byte array, e.g. BRANDA_KEYPAIR) or .keys/<actor>.json. */
export function getSigner(actor: Actor): Promise<KeyPairSigner> {
  if (!signers.has(actor)) {
    signers.set(actor, createKeyPairSignerFromBytes(keypairBytes(`${actor.toUpperCase()}_KEYPAIR`, `${actor}.json`)))
  }
  return signers.get(actor)!
}
export const getHubSigner = () => getSigner('hub')

/** Raw secret bytes for deriving server-side MAC keys; never sent anywhere. */
export const hubSecret = () => keypairBytes('HUB_KEYPAIR', 'hub.json').slice(0, 32)

export async function sendTx(payer: KeyPairSigner, instructions: Instruction[]): Promise<string> {
  const result = await sendTxDetailed(payer, instructions)
  if (result.error) throw result.error.cause
  return result.signature
}

export type TxResult = {
  signature: string
  /** Set when the transaction landed but failed. `code` is the program's custom error code, if any. */
  error?: { code: number | null; message: string; cause: unknown }
}

/**
 * Sends and confirms. With `skipPreflight`, a transaction the program rejects still lands on-chain
 * as a failed transaction, so its signature (and the program's error) can be shown in an explorer.
 */
export async function sendTxDetailed(
  payer: KeyPairSigner,
  instructions: Instruction[],
  opts: { skipPreflight?: boolean } = {},
): Promise<TxResult> {
  const { value: blockhash } = await rpc.getLatestBlockhash().send()
  const tx = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(payer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    ),
  )
  const signature = getSignatureFromTransaction(tx)
  try {
    // @ts-expect-error kit's sendable-transaction brand is not inferred through pipe
    await sendAndConfirm(tx, { commitment: 'confirmed', skipPreflight: opts.skipPreflight })
    return { signature }
  } catch (e) {
    return { signature, error: { code: customErrorCode(e), message: (e as Error).message, cause: e } }
  }
}

/** Walks a kit SolanaError's cause chain for an InstructionError::Custom code. */
function customErrorCode(e: unknown): number | null {
  for (let cur = e as { context?: { code?: unknown }; cause?: unknown } | undefined; cur; cur = cur.cause as typeof cur) {
    if (isSolanaError(cur, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) return Number(cur.context.code)
  }
  return null
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`
export const explorerAddress = (a: string) => `https://explorer.solana.com/address/${a}?cluster=${CLUSTER}`
