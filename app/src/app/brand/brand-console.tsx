'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { kg, when } from '@/lib/format'
import type { Ledger } from '@/lib/server/ledger'

type Brand = 'brandA' | 'brandB'
const BRAND_LABEL: Record<Brand, string> = { brandA: 'Brand A', brandB: 'Brand B' }

type Result = {
  ok: boolean
  brand: string
  weightG: number
  availableG: number
  explorer: string
  claim?: string
  error?: string
}

export function BrandConsole() {
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [brand, setBrand] = useState<Brand>('brandA')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/ledger', { cache: 'no-store' })
    setLedger(await res.json())
  }, [])
  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message))
  }, [refresh])

  async function claim(batch: Ledger['batches'][number]) {
    const typed = amounts[batch.address] ?? '1'
    const weightG = Math.round(Number(typed) * 1000)
    if (!(weightG > 0)) return setError('Enter how many kg to claim')
    setBusy(batch.address)
    setError(null)
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brand, batch: batch.address, weightG }),
      })
      const json = await res.json()
      if (!res.ok && !json.explorer) throw new Error(json.error)
      setResults((r) => [{ ...json, availableG: batch.remainingG }, ...r])
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!ledger) return <p className="text-neutral-500">{error ?? 'Loading from the blockchain…'}</p>

  const claimedBy = (b: Brand) =>
    ledger.batches.flatMap((x) => x.claims).filter((c) => c.brand === BRAND_LABEL[b]).reduce((s, c) => s + c.weightG, 0)
  const open = ledger.batches.filter((b) => b.remainingG > 0)
  const used = ledger.batches.filter((b) => b.remainingG === 0)

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium">Which brand are you?</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(['brandA', 'brandB'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBrand(b)}
              className={`rounded-2xl border p-4 text-left ${brand === b ? 'border-emerald-600 bg-emerald-600/10' : 'border-neutral-200 dark:border-neutral-800'}`}
            >
              <p className="font-semibold">{BRAND_LABEL[b]}</p>
              <p className="text-sm text-neutral-500 tabular-nums">{kg(claimedBy(b))} claimed so far</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Recycled plastic you can claim</h2>
        {open.length === 0 && (
          <p className="mt-1 text-sm text-neutral-500">
            Nothing available. A recycler has to confirm a bale first (step 2).
          </p>
        )}
        <div className="mt-3 space-y-3">
          {open.map((b) => (
            <div key={b.address} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold">From bale #{b.baleIndex + 1}</p>
                <p className="text-sm text-neutral-500">confirmed {when(b.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                The recycler confirmed {kg(b.acceptedG)} from {b.bags} {b.bags === 1 ? 'bag' : 'bags'}.{' '}
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{kg(b.remainingG)} still available.</span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className="h-full bg-emerald-600" style={{ width: `${(b.claimedG / b.acceptedG) * 100}%` }} />
              </div>
              {b.claims.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {b.claims.map((c) => (
                    <li key={c.address}>
                      {c.brand} claimed {kg(c.weightG)} ·{' '}
                      <Link href={`/ledger/${c.address}`} className="underline">
                        see where it came from
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex items-end gap-3">
                <label className="w-32">
                  <span className="text-sm font-medium">Kilos to claim</span>
                  <input
                    inputMode="decimal"
                    value={amounts[b.address] ?? '1'}
                    onChange={(e) => setAmounts((m) => ({ ...m, [b.address]: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 tabular-nums dark:border-neutral-700"
                  />
                </label>
                <button
                  onClick={() => claim(b)}
                  disabled={!!busy}
                  className="flex-1 rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {busy === b.address ? 'Asking the blockchain…' : `Claim as ${BRAND_LABEL[brand]}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-600/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</p>}

      {results.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">What happened</h2>
          {results.map((r) => (
            <div
              key={r.explorer}
              className={`rounded-xl px-4 py-3 text-sm ${r.ok ? 'bg-emerald-600/10 text-emerald-900 dark:text-emerald-200' : 'bg-red-600/10 text-red-900 dark:text-red-200'}`}
            >
              {r.ok ? (
                <p>
                  <span className="font-semibold">{r.brand} claimed {kg(r.weightG)}.</span> Those kilos are now used up; no
                  other brand can count them.
                </p>
              ) : (
                <p>
                  <span className="font-semibold">Refused by the blockchain.</span> {r.brand} asked for {kg(r.weightG)}, but
                  only {kg(r.availableG)} was left. Kilos another brand already claimed can&apos;t be claimed again.
                </p>
              )}
              <p className="mt-1 space-x-3">
                <a href={r.explorer} target="_blank" rel="noreferrer" className="underline">
                  {r.ok ? 'See the record' : 'See the refused attempt'}
                </a>
                {r.claim && (
                  <Link href={`/ledger/${r.claim}`} className="underline">
                    Trace it back to the bags
                  </Link>
                )}
              </p>
            </div>
          ))}
        </section>
      )}

      {used.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-neutral-500">Fully claimed</h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            {used.map((b) => (
              <li key={b.address}>
                Bale #{b.baleIndex + 1}: {kg(b.acceptedG)} claimed by {[...new Set(b.claims.map((c) => c.brand))].join(' and ')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
