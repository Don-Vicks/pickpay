import Link from 'next/link'
import { PICKPAY_PROGRAM_ADDRESS } from '@/generated/pickpay'
import { readLedger } from '@/lib/server/ledger'
import { explorerAddress } from '@/lib/server/solana'

export const dynamic = 'force-dynamic'

const kg = (g: number) => `${(g / 1000).toLocaleString('en-NG', { maximumFractionDigits: 1 })} kg`

const SCREENS = [
  { href: '/hub', title: 'Hub', body: 'Weigh a bag, grade it from a photo, pay the picker in one transaction.' },
  { href: '/brand', title: 'Brands', body: 'Ship a bale, confirm intake, and claim credits. A second claim on the same kilos fails.' },
  { href: '/ledger', title: 'Ledger', body: 'Trace any brand claim back through the recycler to every paid bag.' },
] as const

export default async function Home() {
  const ledger = await readLedger()
  const credited = ledger.batches.reduce((s, b) => s + b.acceptedG, 0)
  const claimed = ledger.batches.reduce((s, b) => s + b.claimedG, 0)

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Plastic recovery on Solana · Lagos demo</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Every kilo paid once, claimed once.</h1>
      <p className="mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
        PickPay pays waste pickers within seconds for plastic that AI grades from a photo. Recycling credits exist only
        after a recycler signs for the plastic, and each kilo can be claimed by exactly one brand.
      </p>

      <dl className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Bags paid', String(ledger.hub.collections)],
          ['Collected', kg(ledger.hub.collectedG)],
          ['Recycled', kg(credited)],
          ['Claimed by brands', kg(claimed)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <dt className="text-xs text-neutral-500">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <nav className="mt-10 grid gap-3 sm:grid-cols-3">
        {SCREENS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-2xl border border-neutral-200 p-5 transition-colors hover:border-emerald-600 dark:border-neutral-800"
          >
            <p className="font-semibold">{s.title} →</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{s.body}</p>
          </Link>
        ))}
      </nav>

      <p className="mt-10 text-xs text-neutral-500">
        Live on Solana devnet · program{' '}
        <a href={explorerAddress(PICKPAY_PROGRAM_ADDRESS)} target="_blank" rel="noreferrer" className="font-mono underline">
          {PICKPAY_PROGRAM_ADDRESS.slice(0, 4)}…{PICKPAY_PROGRAM_ADDRESS.slice(-4)}
        </a>{' '}
        · every figure above is read from on-chain accounts
      </p>
    </main>
  )
}
