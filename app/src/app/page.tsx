import Link from 'next/link'
import { PICKPAY_PROGRAM_ADDRESS } from '@/generated/pickpay'
import { kg } from '@/lib/format'
import { readLedger } from '@/lib/server/ledger'
import { explorerAddress } from '@/lib/server/solana'

export const dynamic = 'force-dynamic'

const STEPS = [
  {
    href: '/hub',
    n: '1',
    who: 'Collection hub',
    what: 'A waste picker brings a bag of plastic. The hub weighs it and takes a photo. AI says what plastic it is and how dirty, which sets the price, and the picker is paid on the spot.',
    cta: 'Pay for a bag',
  },
  {
    href: '/recycler',
    n: '2',
    who: 'Recycler',
    what: 'The hub sends its bags to a recycler as one bale. The recycler weighs what arrived and confirms it. Only that confirmation counts the plastic as recycled.',
    cta: 'Confirm a bale',
  },
  {
    href: '/brand',
    n: '3',
    who: 'Brand',
    what: 'Drinks and packaging companies must prove plastic was recycled for them. A brand claims recycled kilos. Each kilo can be claimed once; a second claim is refused.',
    cta: 'Claim recycled plastic',
  },
] as const

export default async function Home() {
  const ledger = await readLedger()
  const recycled = ledger.batches.reduce((s, b) => s + b.acceptedG, 0)
  const claimed = ledger.batches.reduce((s, b) => s + b.claimedG, 0)

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Plastic recycling in Lagos · demo</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Every kilo paid once, claimed once.</h1>
      <p className="mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
        PickPay follows plastic from the person who picks it up to the company that has to prove it was recycled. Every
        step is recorded on a public blockchain (Solana), so nobody can pay for the same bag twice or count the same kilo
        twice.
      </p>

      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-neutral-500">How it works</h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n}>
            <Link
              href={s.href}
              className="flex h-full flex-col rounded-2xl border border-neutral-200 p-5 transition-colors hover:border-emerald-600 dark:border-neutral-800"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                {s.n}
              </span>
              <p className="mt-3 font-semibold">{s.who}</p>
              <p className="mt-1 flex-1 text-sm text-neutral-600 dark:text-neutral-400">{s.what}</p>
              <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">{s.cta} →</p>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
        Then anyone can open the{' '}
        <Link href="/ledger" className="font-medium underline">
          public ledger
        </Link>{' '}
        and trace a brand&apos;s claim back to the bags it came from.
      </p>

      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-neutral-500">So far in this demo</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Bags paid for', String(ledger.hub.collections)],
          ['Plastic collected', kg(ledger.hub.collectedG)],
          ['Confirmed recycled', kg(recycled)],
          ['Claimed by brands', kg(claimed)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <dt className="text-xs text-neutral-500">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-10 text-xs text-neutral-500">
        Runs on Solana devnet (a free test network) with test money (tUSDC) ·{' '}
        <a href={explorerAddress(PICKPAY_PROGRAM_ADDRESS)} target="_blank" rel="noreferrer" className="underline">
          the PickPay program
        </a>{' '}
        · every number on this site is read from the blockchain
      </p>
    </main>
  )
}
