'use client'

import { useRef, useState } from 'react'

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

const POLYMER_LABEL = { pet: 'PET bottles', hdpe: 'HDPE containers', mixed: 'Mixed plastic' } as const
const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const usdc = (baseUnits: string) => (Number(baseUnits) / 1e6).toFixed(2)

export function HubForm() {
  const [phone, setPhone] = useState('')
  const [wallet, setWallet] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [grade, setGrade] = useState<GradeResponse | null>(null)
  const [paid, setPaid] = useState<CollectResponse | null>(null)
  const [busy, setBusy] = useState<'grading' | 'paying' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const weightG = Math.round(Number(weightKg) * 1000)
  const canGrade = !!photo && weightG > 0 && phone.trim().length >= 10 && !busy

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
        body: JSON.stringify({ quoteToken: grade.quoteToken, phone, wallet }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Payment failed')
      setPaid(json)
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
    if (fileInput.current) fileInput.current.value = ''
  }

  if (paid && grade) {
    return (
      <section className="rounded-2xl border border-emerald-600/30 bg-emerald-600/10 p-6">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {paid.accrued ? 'Saved to picker balance' : 'Paid'} · confirmed in {(paid.confirmedMs / 1000).toFixed(1)} s
        </p>
        <p className="mt-2 text-4xl font-semibold tabular-nums">{naira(grade.ngnTotal)}</p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 tabular-nums">
          {usdc(paid.amount)} tUSDC · bag #{paid.collectionIndex} · {(grade.weightG / 1000).toFixed(1)} kg{' '}
          {POLYMER_LABEL[grade.grade.polymer]}
        </p>
        <a
          href={paid.explorer}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block truncate font-mono text-xs text-emerald-700 underline dark:text-emerald-400"
        >
          {paid.signature}
        </a>
        <button onClick={nextBag} className="mt-6 w-full rounded-xl bg-neutral-900 py-3 font-medium text-white dark:bg-white dark:text-neutral-900">
          Next bag
        </button>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium">Picker phone</span>
        <input
          inputMode="tel"
          autoComplete="off"
          placeholder="0803 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-lg dark:border-neutral-700"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Picker wallet <span className="font-normal text-neutral-500">(optional — otherwise saved to their phone balance)</span></span>
        <input
          autoComplete="off"
          spellCheck={false}
          placeholder="Solana address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 font-mono text-sm dark:border-neutral-700"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Scale weight (kg)</span>
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
        <span className="text-sm font-medium">Bag photo</span>
        <label className="mt-1 flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-400 dark:border-neutral-600">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={preview} alt="Bag to grade" className="h-full w-full object-cover" />
          ) : (
            <span className="text-neutral-500">Tap to take a photo</span>
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
          <div className="flex items-baseline justify-between">
            <p className="text-lg font-semibold">{POLYMER_LABEL[grade.grade.polymer]}</p>
            <p className="text-sm text-neutral-500 tabular-nums">
              {(grade.grade.contaminationBps / 100).toFixed(0)}% contamination · {grade.grade.confidence} confidence
            </p>
          </div>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{grade.grade.notes}</p>
          <div className="mt-4 flex items-baseline justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <span className="text-sm text-neutral-500 tabular-nums">
              {naira(grade.ngnPerKg)}/kg × {(grade.weightG / 1000).toFixed(1)} kg
            </span>
            <span className="text-2xl font-semibold tabular-nums">{naira(grade.ngnTotal)}</span>
          </div>
        </section>
      )}

      {error && <p className="rounded-xl bg-red-600/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</p>}

      {grade ? (
        <button
          onClick={pay}
          disabled={!!busy}
          className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white disabled:opacity-60"
        >
          {busy === 'paying' ? 'Paying…' : `Pay ${naira(grade.ngnTotal)}`}
        </button>
      ) : (
        <button
          onClick={runGrade}
          disabled={!canGrade}
          className="w-full rounded-xl bg-neutral-900 py-4 text-lg font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {busy === 'grading' ? 'Grading…' : 'Grade bag'}
        </button>
      )}
    </div>
  )
}
