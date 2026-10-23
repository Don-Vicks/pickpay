import type { Metadata } from 'next'
import { BrandConsole } from './brand-console'

export const metadata: Metadata = { title: 'Brand claims · PickPay' }

export default function BrandPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">PickPay · EPR recovery credits</p>
        <h1 className="mt-1 text-2xl font-semibold">Claim recycled plastic once</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Credits exist only after a recycler confirms intake. Once a brand retires a kilo, the program rejects anyone
          else&apos;s claim on it.
        </p>
      </header>
      <BrandConsole />
    </main>
  )
}
