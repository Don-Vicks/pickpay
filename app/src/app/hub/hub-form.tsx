'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { kg, naira, usdc, when } from '@/lib/format'

type GradeResponse = {
  grade: { polymer: 'pet' | 'hdpe' | 'mixed'; contaminationBps: number; confidence: string; notes: string }
  weightG: number
  ngnPerKg: number
  ngnTotal: number
  amount: string
  photoHash: string
  quoteToken: string
}

type CollectResponse = {
  signature: string
  explorer: string
  confirmedMs: number
  collectionIndex: string
  accrued: boolean
  amount: string
}

type Bag = { index: number; weightG: number; polymer: number; contaminationBps: number; ngn: number; toWallet: boolean; createdAt: number }

const PLASTIC = {
  pet: 'Clear plastic bottles (PET)',
  hdpe: 'Hard plastic containers (HDPE)',
  mixed: 'Mixed plastic',
} as const
const PLASTIC_BY_INDEX = [PLASTIC.pet, PLASTIC.hdpe, PLASTIC.mixed]

export function HubForm() {
  const [phone, setPhone] = useState('')
  const [hasWallet, setHasWallet] = useState(false)
  const [wallet, setWallet] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [grade, setGrade] = useState<GradeResponse | null>(null)
  const [paid, setPaid] = useState<CollectResponse | null>(null)
  const [busy, setBusy] = useState<'grading' | 'paying' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bags, setBags] = useState<Bag[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const loadBags = useCallback(async () => {
    const res = await fetch('/api/bags', { cache: 'no-store' })
    if (res.ok) setBags(await res.json())
  }, [])
  useEffect(() => {
    loadBags()
  }, [loadBags])

  const weightG = Math.round(Number(weightKg) * 1000)
  const missing = [
    phone.replace(/\D/g, '').length < 10 && 'phone number',
    !(weightG > 0) && 'weight',
    !photo && 'photo',
  ].filter(Boolean) as string[]

  function pickPhoto(file: File | null) {
    setPhoto(file)
    setGrade(null)
    setError(null)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return file ? URL.createObjectURL(file) : null
    })
  }

  async function runGrade() {
    if (!photo) return
    setBusy('grading')
    setError(null)
    try {
      const form = new FormData()
      form.set('photo', photo)
      form.set('weightG', String(weightG))
      const res = await fetch('/api/grade', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Grading failed')
      setGrade(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function pay() {
    if (!grade) return
    setBusy('paying')
    setError(null)
    try {
      const res = await fetch('/api/collect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quoteToken: grade.quoteToken, phone, wallet: hasWallet ? wallet : '' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Payment failed')
      setPaid(json)
      loadBags()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function nextBag() {
    pickPhoto(null)
    setPaid(null)
    setWeightKg('')
    setPhone('')
    setWallet('')
    setHasWallet(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="space-y-8">
      {paid && grade ? (
        <section className="rounded-2xl border border-emerald-600/30 bg-emerald-600/10 p-6">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {paid.accrued ? "Saved to the picker's balance" : 'Paid to the picker'}
          </p>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{naira(grade.ngnTotal)}</p>
          <p className="mt-1 text-sm text-neutral-600 tabular-nums dark:text-neutral-400">
            Bag #{Number(paid.collectionIndex) + 1} · {kg(grade.weightG)} of {PLASTIC[grade.grade.polymer].toLowerCase()} · paid
            as {usdc(paid.amount)} test dollars (tUSDC)
          </p>
          <p className="mt-3 text-sm">
            Recorded on the blockchain in {(paid.confirmedMs / 1000).toFixed(1)} seconds.{' '}
            <a href={paid.explorer} target="_blank" rel="noreferrer" className="font-medium text-emerald-700 underline dark:text-emerald-400">
              See the record
            </a>
          </p>
          <button onClick={nextBag} className="mt-6 w-full rounded-xl bg-neutral-900 py-3 font-medium text-white dark:bg-white dark:text-neutral-900">
            Next bag
          </button>
        </section>
      ) : (
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium">Picker&apos;s phone number</span>
            <input
              inputMode="tel"
              autoComplete="off"
              placeholder="0803 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-lg dark:border-neutral-700"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Pickers are known by phone number. Only a scrambled version is stored, never the number.
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasWallet} onChange={(e) => setHasWallet(e.target.checked)} className="h-4 w-4" />
            The picker has a crypto wallet (otherwise the money waits in their phone-number balance)
          </label>
          {hasWallet && (
            <input
              autoComplete="off"
              spellCheck={false}
              placeholder="Picker's Solana wallet address"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 font-mono text-sm dark:border-neutral-700"
            />
          )}

          <label className="block">
            <span className="text-sm font-medium">Weight on the scale (kg)</span>
            <input
              inputMode="decimal"
              placeholder="6.2"
              value={weightKg}
              onChange={(e) => {
                setWeightKg(e.target.value)
                setGrade(null)
              }}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-lg tabular-nums dark:border-neutral-700"
            />
          </label>

          <div>
            <span className="text-sm font-medium">Photo of the bag</span>
            <label className="mt-1 flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-400 dark:border-neutral-600">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img src={preview} alt="Bag to grade" className="h-full w-full object-cover" />
              ) : (
                <span className="px-6 text-center text-neutral-500">Tap to take or choose a photo of the plastic</span>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {grade && (
            <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">What the AI sees</p>
              <p className="mt-1 text-lg font-semibold">{PLASTIC[grade.grade.polymer]}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                About {(grade.grade.contaminationBps / 100).toFixed(0)}% dirt or other material · {grade.grade.confidence} confidence
              </p>
              <p className="mt-2 text-sm italic text-neutral-600 dark:text-neutral-400">“{grade.grade.notes}”</p>
              <div className="mt-4 flex items-baseline justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <span className="text-sm text-neutral-500 tabular-nums">
                  {naira(grade.ngnPerKg)} per kg × {kg(grade.weightG)}
                </span>
                <span className="text-2xl font-semibold tabular-nums">{naira(grade.ngnTotal)}</span>
              </div>
            </section>
          )}

          {error && <p className="rounded-xl bg-red-600/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</p>}

          {grade ? (
            <button onClick={pay} disabled={!!busy} className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white disabled:opacity-60">
              {busy === 'paying' ? 'Paying…' : `Pay the picker ${naira(grade.ngnTotal)}`}
            </button>
          ) : (
            <>
              <button
                onClick={runGrade}
                disabled={missing.length > 0 || !!busy}
                className="w-full rounded-xl bg-neutral-900 py-4 text-lg font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
              >
                {busy === 'grading' ? 'Looking at the photo…' : 'Check the bag and price it'}
              </button>
              {missing.length > 0 && <p className="text-center text-xs text-neutral-500">Still needed: {missing.join(', ')}</p>}
            </>
          )}
        </div>
      )}

      {bags.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">Recent bags at this hub</h2>
          <ul className="mt-2 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
            {bags.map((b) => (
              <li key={b.index} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-medium">Bag #{b.index + 1}</span>{' '}
                  <span className="text-neutral-500">
                    {kg(b.weightG)} · {PLASTIC_BY_INDEX[b.polymer]}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {naira(b.ngn)}
                  <span className="block text-xs text-neutral-500">{b.toWallet ? 'to wallet' : 'to phone balance'} · {when(b.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
