'use client'

import { useCallback, useEffect, useState } from 'react'

type Ledger = {
  hub: { collectedG: number; shippedG: number; unshippedG: number; collections: number; bales: number }
  batches: {
    address: string
    acceptedG: number
    claimedG: number
    remainingG: number
    claims: { address: string; brand: string; weightG: number }[]
  }[]
}

type ClaimResult = {
  ok: boolean
  brand: string
  weightG: number
  explorer: string
  errorName?: string | null
  error?: string
}

type Brand = 'brandA' | 'brandB'

const kg = (g: number) => `${(g / 1000).toLocaleString('en-NG', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`

export function BrandConsole() {
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [brand, setBrand] = useState<Brand>('brandA')
  const [amountKg, setAmountKg] = useState('15')
  const [results, setResults] = useState<ClaimResult[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/ledger', { cache: 'no-store' })
    setLedger(await res.json())
  }, [])

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message))
  }, [refresh])

  async function intake() {
    setBusy('intake')
    setError(null)
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ acceptedPct: 95 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function claim(batch: string) {
    setBusy(batch)
    setError(null)
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brand, batch, weightG: Math.round(Number(amountKg) * 1000) }),
      })
      const json = await res.json()
      if (!res.ok && !json.explorer) throw new Error(json.error)
      setResults((r) => [json, ...r])
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!ledger) return <p className="text-neutral-500">{error ?? 'Reading the ledger from devnet…'}</p>

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <Stat label="Collected" value={kg(ledger.hub.collectedG)} sub={`${ledger.hub.collections} bags`} />
        <Stat label="Shipped" value={kg(ledger.hub.shippedG)} sub={`${ledger.hub.bales} bales`} />
        <Stat label="At hub" value={kg(ledger.hub.unshippedG)} sub="not yet shipped" />
        {ledger.hub.unshippedG > 0 && (
          <button
            onClick={intake}
            disabled={!!busy}
            className="col-span-3 mt-1 rounded-xl border border-neutral-300 py-2.5 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
          >
            {busy === 'intake' ? 'Shipping and confirming…' : `Ship ${kg(ledger.hub.unshippedG)} → recycler confirms intake (95% accepted)`}
          </button>
        )}
      </section>

      <section className="flex flex-wrap items-end gap-3">
        <div>
          <span className="text-sm font-medium">Claim as</span>
          <div className="mt-1 flex rounded-xl border border-neutral-300 p-1 dark:border-neutral-700">
            {(['brandA', 'brandB'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBrand(b)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${brand === b ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : ''}`}
              >
                {b === 'brandA' ? 'Brand A' : 'Brand B'}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className="text-sm font-medium">Amount (kg)</span>
          <input
            inputMode="decimal"
            value={amountKg}
            onChange={(e) => setAmountKg(e.target.value)}
            className="mt-1 block w-28 rounded-xl border border-neutral-300 bg-transparent px-3 py-2 tabular-nums dark:border-neutral-700"
          />
        </label>
      </section>

      {ledger.batches.length === 0 && (
        <p className="text-sm text-neutral-500">No recovery credits yet. Ship a bale and confirm intake first.</p>
      )}

      {ledger.batches.map((b) => (
        <section key={b.address} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-semibold">Credit batch {short(b.address)}</p>
            <p className="text-sm tabular-nums text-neutral-500">{kg(b.acceptedG)} recycled</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div className="h-full bg-emerald-600" style={{ width: `${(b.claimedG / b.acceptedG) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm tabular-nums">
            <span className="font-medium">{kg(b.remainingG)}</span> left to claim · {kg(b.claimedG)} retired
          </p>
          {b.claims.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              {b.claims.map((c) => (
                <li key={c.address} className="tabular-nums">
                  {c.brand} retired {kg(c.weightG)}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => claim(b.address)}
            disabled={!!busy}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy === b.address ? 'Sending to devnet…' : `Claim ${amountKg || 0} kg as ${brand === 'brandA' ? 'Brand A' : 'Brand B'}`}
          </button>
        </section>
      ))}

      {error && <p className="rounded-xl bg-red-600/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</p>}

      {results.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-medium">On-chain results</p>
          {results.map((r) => (
            <div
              key={r.explorer}
              className={`rounded-xl px-4 py-3 text-sm ${r.ok ? 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300' : 'bg-red-600/10 text-red-800 dark:text-red-300'}`}
            >
              <p className="font-medium">
                {r.ok
                  ? `${r.brand} retired ${kg(r.weightG)}`
                  : `Rejected by the program: ${r.errorName ?? 'error'}`}
              </p>
              {!r.ok && (
                <p className="mt-0.5">
                  {r.brand} tried to claim {kg(r.weightG)}. {r.error}.
                </p>
              )}
              <a href={r.explorer} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">
                {r.ok ? 'View transaction' : 'View failed transaction'}
              </a>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-neutral-500">{sub}</p>
    </div>
  )
}
