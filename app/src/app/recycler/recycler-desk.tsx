'use client'

import { useCallback, useEffect, useState } from 'react'
import { kg, when } from '@/lib/format'
import type { Ledger } from '@/lib/server/ledger'

type Notice = { ok: boolean; text: string; explorer?: string }

export function RecyclerDesk() {
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [arrivedKg, setArrivedKg] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/ledger', { cache: 'no-store' })
    setLedger(await res.json())
  }, [])
  useEffect(() => {
    refresh().catch((e) => setNotice({ ok: false, text: (e as Error).message }))
  }, [refresh])

  async function post(key: string, url: string, body?: unknown) {
    setBusy(key)
    setNotice(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json()
      await refresh()
      return { ok: res.ok, json }
    } finally {
      setBusy(null)
    }
  }

  async function ship() {
    const { ok, json } = await post('ship', '/api/ship')
    setNotice(
      ok
        ? { ok, text: `Bale #${json.baleIndex + 1} sent: ${json.bags} bags, ${kg(json.weightG)}. Now weigh it below.`, explorer: json.explorer }
        : { ok, text: json.error },
    )
  }

  async function confirm(bale: Ledger['bales'][number]) {
    const typed = arrivedKg[bale.address] ?? (bale.weightG * 0.95 / 1000).toFixed(1)
    const { ok, json } = await post(bale.address, '/api/intake', { bale: bale.address, acceptedG: Math.round(Number(typed) * 1000) })
    setNotice(
      ok
        ? { ok, text: `Confirmed ${kg(json.acceptedG)} recycled from bale #${bale.index + 1}. Brands can now claim it.`, explorer: json.explorer }
        : { ok, text: json.error, explorer: json.explorer },
    )
  }

  if (!ledger) return <p className="text-neutral-500">Loading from the blockchain…</p>

  const waiting = ledger.bales.filter((b) => !b.confirmed)
  const done = ledger.bales.filter((b) => b.confirmed)

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-semibold">At the hub, not sent yet</h2>
        {ledger.hub.unshippedG > 0 ? (
          <>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {ledger.hub.unshippedBags} paid {ledger.hub.unshippedBags === 1 ? 'bag' : 'bags'}, {kg(ledger.hub.unshippedG)} in total. The hub sends them to you
              as one bale.
            </p>
            <button
              onClick={ship}
              disabled={!!busy}
              className="mt-4 w-full rounded-xl bg-neutral-900 py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {busy === 'ship' ? 'Sending…' : `Hub sends ${kg(ledger.hub.unshippedG)} as a bale`}
            </button>
          </>
        ) : (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Nothing waiting. Pay for some bags on the Hub page first.
          </p>
        )}
      </section>

      <section>
        <h2 className="font-semibold">Bales to weigh and confirm</h2>
        {waiting.length === 0 && <p className="mt-1 text-sm text-neutral-500">None right now.</p>}
        <div className="mt-3 space-y-3">
          {waiting.map((b) => (
            <div key={b.address} className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold">Bale #{b.index + 1}</p>
                <p className="text-sm text-neutral-500">sent {when(b.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                The hub says {kg(b.weightG)} in {b.bags} {b.bags === 1 ? 'bag' : 'bags'}. Weigh it and enter what actually
                arrived; you can&apos;t confirm more than was sent.
              </p>
              <div className="mt-4 flex items-end gap-3">
                <label className="flex-1">
                  <span className="text-sm font-medium">Weight that arrived (kg)</span>
                  <input
                    inputMode="decimal"
                    value={arrivedKg[b.address] ?? ((b.weightG * 0.95) / 1000).toFixed(1)}
                    onChange={(e) => setArrivedKg((m) => ({ ...m, [b.address]: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 tabular-nums dark:border-neutral-700"
                  />
                </label>
                <button
                  onClick={() => confirm(b)}
                  disabled={!!busy}
                  className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {busy === b.address ? 'Confirming…' : 'Confirm'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {notice && (
        <p className={`rounded-xl px-4 py-3 text-sm ${notice.ok ? 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300' : 'bg-red-600/10 text-red-800 dark:text-red-300'}`}>
          {notice.text}{' '}
          {notice.explorer && (
            <a href={notice.explorer} target="_blank" rel="noreferrer" className="underline">
              View on the blockchain
            </a>
          )}
        </p>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="font-semibold">Confirmed</h2>
          <ul className="mt-2 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
            {done.map((b) => (
              <li key={b.address} className="flex justify-between px-4 py-3 tabular-nums">
                <span>Bale #{b.index + 1} · {b.bags} bags</span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  sent {kg(b.weightG)} · confirmed {kg(b.acceptedG ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
