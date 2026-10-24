import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isAddress } from '@solana/kit'
import { claimExists, traceClaim } from '@/lib/server/trace'
import { explorerAddress } from '@/lib/server/solana'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Claim ledger · PickPay' }

const kg = (g: number) => `${(g / 1000).toLocaleString('en-NG', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
const usdc = (base: number) => `${(base / 1e6).toFixed(2)} tUSDC`
const short = (s: string, n = 4) => `${s.slice(0, n)}…${s.slice(-n)}`
const when = (unix: number) =>
  new Date(unix * 1000).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })

function Account({ address, label }: { address: string; label?: string }) {
  return (
    <a href={explorerAddress(address)} target="_blank" rel="noreferrer" className="font-mono text-xs underline decoration-neutral-400">
      {label ?? short(address)}
    </a>
  )
}

function Step({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <li className="relative pl-7">
      <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-emerald-600" />
      {!last && <span className="absolute left-[5px] top-5 h-[calc(100%-0.5rem)] w-0.5 bg-emerald-600/30" />}
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-1 pb-6 text-sm text-neutral-600 dark:text-neutral-400">{children}</div>
    </li>
  )
}

export default async function ClaimLedgerPage({ params }: { params: Promise<{ claim: string }> }) {
  const { claim: claimParam } = await params
  if (!isAddress(claimParam) || !(await claimExists(claimParam))) notFound()
  const t = await traceClaim(claimParam)

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/ledger" className="text-sm text-neutral-500 underline">
        ← All claims
      </Link>
      <header className="mt-4">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Public ledger · one brand claim, traced to the bags</p>
        <h1 className="mt-1 text-2xl font-semibold">
          {t.claim.brandName ?? short(t.claim.brand)} claimed {kg(t.claim.weightG)} of recycled plastic
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Read from bottom to top, this is the plastic&apos;s journey: bags paid for at the hub, sent to a recycler as a bale,
          confirmed by the recycler, then claimed by the brand. Every line is a record on the blockchain, so anyone can check
          it, and these kilos can&apos;t be claimed by anyone else.
        </p>
      </header>

      <ol className="mt-8">
        <Step title={`Claim · ${when(t.claim.createdAt)}`}>
          {t.claim.brandName ?? 'The brand'} claimed {kg(t.claim.weightG)}.{' '}
          <Account address={t.claim.address} label="record" />
        </Step>
        <Step title={`Recycler confirmed · ${when(t.batch.createdAt)}`}>
          {t.batch.recyclerName ?? 'The recycler'} weighed the bale and confirmed {kg(t.batch.acceptedG)} as
          recycled; brands have claimed {kg(t.batch.claimedG)} of it so far.{' '}
          <Account address={t.batch.address} label="record" />
        </Step>
        <Step title={`Bale #${t.bale.index + 1} sent to the recycler · ${when(t.bale.createdAt)}`}>
          The hub sent {kg(t.bale.weightG)}.{' '}
          <Account address={t.bale.address} label="record" />
        </Step>
        <Step title={`${t.bags.length} ${t.bags.length === 1 ? 'bag' : 'bags'} paid for at the hub`} last>
          {kg(t.bagsWeightG)} in total; pickers were paid {usdc(t.pickersPaid)} on the spot.
        </Step>
      </ol>

      <section className="grid gap-3 sm:grid-cols-2">
        {t.bags.map((b) => (
          <article key={b.address} className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
            {b.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- served by the hub's photo route
              <img src={`/api/photo/${b.photoHash}`} alt={`Bag #${b.index}`} className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-neutral-100 text-xs text-neutral-500 dark:bg-neutral-900">
                Photo not available
              </div>
            )}
            <div className="space-y-1 p-4 text-sm">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold">Bag #{b.index + 1}</p>
                <p className="tabular-nums">{kg(b.weightG)}</p>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400">
                {b.polymer} · {(b.contaminationBps / 100).toFixed(0)}% dirt or other material · {usdc(b.amount)} paid{' '}
                {b.paidToWallet ? 'to the picker\'s wallet' : 'to the picker\'s phone balance'}
              </p>
              <p className="text-xs text-neutral-500">
                Picker <span className="font-mono">{short(b.pickerHash, 6)}</span> (scrambled phone number) ·{' '}
                {when(b.createdAt)}
              </p>
              <p className="text-xs text-neutral-500">
                Photo fingerprint <span className="font-mono">{short(b.photoHash, 6)}</span>
                {b.photo && (b.photo.verified ? ' · photo matches the blockchain record ✓' : ' · photo does NOT match the record')}
              </p>
              <Account address={b.address} label="record" />
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
