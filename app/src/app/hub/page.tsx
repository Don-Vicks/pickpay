import type { Metadata } from 'next'
import { HubForm } from './hub-form'

export const metadata: Metadata = { title: 'Hub · PickPay' }

export default function HubPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <header className="mb-6">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">PickPay hub · Lagos demo</p>
        <h1 className="mt-1 text-2xl font-semibold">Weigh, grade, pay</h1>
      </header>
      <HubForm />
    </main>
  )
}
