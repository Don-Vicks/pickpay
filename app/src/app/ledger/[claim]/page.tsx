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
        All claims
      </Link>
      <header className="mt-4">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">EPR recovery claim · Solana devnet</p>
        <h1 className="mt-1 text-2xl font-semibold">
          {t.claim.brandName ?? short(t.claim.brand)} retired {kg(t.claim.weightG)} of recycled plastic
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Every figure on this page is read from on-chain accounts. The program only creates credits after a recycler
          signs intake, and once these kilos are retired nobody can claim them again.
        </p>
      </header>

      <ol className="mt-8">
        <Step title={`Claim · ${when(t.claim.createdAt)}`}>
          {t.claim.brandName ?? 'Brand'} (<Account address={t.claim.brand} />) retired {kg(t.claim.weightG)}.{' '}
          <Account address={t.claim.address} label="Claim account" />
        </Step>
        <Step title={`Recovery credits · ${when(t.batch.createdAt)}`}>
          {t.batch.recyclerName ?? 'Recycler'} (<Account address={t.batch.recycler} />) signed intake for{' '}
          {kg(t.batch.acceptedG)}; {kg(t.batch.claimedG)} of it is retired across all brands.{' '}
          <Account address={t.batch.address} label="Credit batch" />
        </Step>
        <Step title={`Bale #${t.bale.index} shipped · ${when(t.bale.createdAt)}`}>
          The hub (<Account address={t.bale.hub} />) shipped {kg(t.bale.weightG)} to that recycler.{' '}
          <Account address={t.bale.address} label="Bale account" />
        </Step>
        <Step title={`${t.bags.length} ${t.bags.length === 1 ? 'bag' : 'bags'}, each paid when it was weighed`} last>
          {kg(t.bagsWeightG)} collected; pickers were paid {usdc(t.pickersPaid)} in total.
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
                Photo not on this hub
              </div>
            )}
            <div className="space-y-1 p-4 text-sm">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold">Bag #{b.index}</p>
                <p className="tabular-nums">{kg(b.weightG)}</p>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400">
                {b.polymer} · {(b.contaminationBps / 100).toFixed(0)}% contamination · {usdc(b.amount)}{' '}
                {b.paidToWallet ? 'paid to wallet' : 'saved to picker balance'}
              </p>
              <p className="text-xs text-neutral-500">
                Picker <span className="font-mono">{short(b.pickerHash, 6)}</span> (salted phone hash) ·{' '}
                {when(b.createdAt)}
              </p>
              <p className="text-xs text-neutral-500">
                Photo SHA-256 <span className="font-mono">{short(b.photoHash, 6)}</span>
                {b.photo && (b.photo.verified ? ' · matches the chain ✓' : ' · does NOT match the chain')}
              </p>
              <Account address={b.address} label="Collection account" />
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
