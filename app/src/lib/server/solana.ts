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
  pipe,
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

let hubSigner: Promise<KeyPairSigner> | undefined
/** The hub operator's key (HUB_KEYPAIR as a JSON byte array, else .keys/hub.json). */
export const getHubSigner = () => (hubSigner ??= createKeyPairSignerFromBytes(keypairBytes('HUB_KEYPAIR', 'hub.json')))

/** Raw secret bytes for deriving server-side MAC keys; never sent anywhere. */
export const hubSecret = () => keypairBytes('HUB_KEYPAIR', 'hub.json').slice(0, 32)

export async function sendTx(payer: KeyPairSigner, instructions: Instruction[]): Promise<string> {
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

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`
export const explorerAddress = (a: string) => `https://explorer.solana.com/address/${a}?cluster=${CLUSTER}`
