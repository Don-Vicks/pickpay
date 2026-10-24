import type { Metadata } from 'next'
import Link from 'next/link'
import { readLedger } from '@/lib/server/ledger'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Ledger · PickPay' }

const kg = (g: number) => `${(g / 1000).toLocaleString('en-NG', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`

export default async function LedgerPage() {
  const ledger = await readLedger()
  const claims = ledger.batches.flatMap((b) => b.claims.map((c) => ({ ...c, batch: b.address })))

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">PickPay public ledger · Solana devnet</p>
      <h1 className="mt-1 text-2xl font-semibold">Every claim, traced to the bag</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {kg(ledger.hub.collectedG)} collected in {ledger.hub.collections} paid bags · {kg(ledger.hub.shippedG)} shipped
        to recyclers · {kg(claims.reduce((s, c) => s + c.weightG, 0))} retired by brands
      </p>

      {claims.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">No brand has claimed credits yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {claims.map((c) => (
            <li key={c.address}>
              <Link href={`/ledger/${c.address}`} className="flex items-baseline justify-between px-4 py-3 hover:bg-neutral-500/5">
                <span className="font-medium">{c.brand}</span>
                <span className="tabular-nums text-neutral-600 dark:text-neutral-400">{kg(c.weightG)} retired →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
