// Creates the demo's devnet actors and a test-USDC mint, idempotently.
// Keypairs go to .keys/ (gitignored); public addresses go to scripts/devnet.json.
// Funding comes from the Solana CLI wallet (~/.config/solana/id.json), not airdrops.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getAddressEncoder,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
  type KeyPairSigner,
} from '@solana/kit'
import { getCreateAccountInstruction, getTransferSolInstruction } from '@solana-program/system'
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
} from '@solana-program/token'

const RPC_URL = process.env.RPC_URL ?? 'https://api.devnet.solana.com'
const WS_URL = process.env.WS_URL ?? RPC_URL.replace('https', 'wss')
const ROOT = new URL('..', import.meta.url).pathname
const KEYS = join(ROOT, '.keys')
const OUT = join(ROOT, 'scripts', 'devnet.json')

const ROLES = ['hub', 'recycler', 'brandA', 'brandB', 'picker', 'mintAuthority'] as const
const SOL_TARGET = 300_000_000n // 0.3 SOL per actor
const SOL_MIN = 100_000_000n // top up below 0.1 SOL
const DECIMALS = 6
const HUB_FLOAT = 10_000n * 10n ** BigInt(DECIMALS) // 10,000 tUSDC for picker payouts

const rpc = createSolanaRpc(RPC_URL)
const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions: createSolanaRpcSubscriptions(WS_URL),
})

async function loadOrCreate(name: string): Promise<KeyPairSigner> {
  const file = join(KEYS, `${name}.json`)
  if (existsSync(file)) return createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(readFileSync(file, 'utf8'))))
  const seed = crypto.getRandomValues(new Uint8Array(32))
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, true)
  // Solana CLI format: 32-byte secret followed by 32-byte public key.
  const bytes = [...seed, ...getAddressEncoder().encode(signer.address)]
  writeFileSync(file, JSON.stringify(bytes), { mode: 0o600 })
  return signer
}

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
  mkdirSync(KEYS, { recursive: true })
  const funder = await createKeyPairSignerFromBytes(
    new Uint8Array(JSON.parse(readFileSync(join(homedir(), '.config/solana/id.json'), 'utf8'))),
  )
  const actors = Object.fromEntries(
    await Promise.all(ROLES.map(async (r) => [r, await loadOrCreate(r)] as const)),
  ) as Record<(typeof ROLES)[number], KeyPairSigner>
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}

  // 1. Top up SOL for every actor in one transaction.
  const topUps: Instruction[] = []
  for (const r of ROLES) {
    const { value } = await rpc.getBalance(actors[r].address).send()
    if (value < SOL_MIN) {
      topUps.push(getTransferSolInstruction({ source: funder, destination: actors[r].address, amount: lamports(SOL_TARGET - value) }))
    }
  }
  if (topUps.length) console.log(`funded ${topUps.length} actors:`, await send(funder, topUps))
  else console.log('all actors already funded')

  // 2. Create the test-USDC mint once.
  let mint: string = prev.mint
  const mintExists = mint && (await rpc.getAccountInfo(mint as never, { encoding: 'base64' }).send()).value
  if (!mintExists) {
    const mintSigner = await loadOrCreate('mint')
    const space = BigInt(getMintSize())
    const rent = await rpc.getMinimumBalanceForRentExemption(space).send()
    const sig = await send(funder, [
      getCreateAccountInstruction({ payer: funder, newAccount: mintSigner, lamports: rent, space, programAddress: TOKEN_PROGRAM_ADDRESS }),
      getInitializeMint2Instruction({ mint: mintSigner.address, decimals: DECIMALS, mintAuthority: actors.mintAuthority.address, freezeAuthority: null }),
    ])
    mint = mintSigner.address
    console.log('created tUSDC mint', mint, sig)
  } else console.log('tUSDC mint exists', mint)

  // 3. Make sure every actor has an ATA; float the hub on first run.
  const atas: Record<string, string> = {}
  const ataIxs: Instruction[] = []
  for (const r of ROLES) {
    if (r === 'mintAuthority') continue
    const [ata] = await findAssociatedTokenPda({ owner: actors[r].address, mint: mint as never, tokenProgram: TOKEN_PROGRAM_ADDRESS })
    atas[r] = ata
    ataIxs.push(await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: funder, owner: actors[r].address, mint: mint as never }))
  }
  if (!mintExists) {
    ataIxs.push(getMintToInstruction({ mint: mint as never, token: atas.hub as never, mintAuthority: actors.mintAuthority, amount: HUB_FLOAT }))
  }
  console.log('ATAs ready:', await send(funder, ataIxs))

  const { value: hubBal } = await rpc.getTokenAccountBalance(atas.hub as never).send()
  const out = {
    cluster: 'devnet',
    rpc: RPC_URL,
    mint,
    decimals: DECIMALS,
    actors: Object.fromEntries(ROLES.map((r) => [r, { address: actors[r].address, ata: atas[r] ?? null }])),
    hubFloat: hubBal.uiAmountString,
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`hub float ${hubBal.uiAmountString} tUSDC; wrote ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
