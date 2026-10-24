import type { Metadata } from 'next'
import { RoleHeader } from '@/components/nav'
import { BrandConsole } from './brand-console'

export const metadata: Metadata = { title: 'Brand · PickPay' }

export default function BrandPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <RoleHeader step="3" role="You are a brand" title="Claim recycled plastic">
        Companies that sell plastic packaging in Nigeria must now prove plastic was recovered and recycled for them. Claim
        kilos the recycler confirmed. Each kilo can be claimed by one brand only: try claiming the same kilos as the other
        brand and the blockchain refuses.
      </RoleHeader>
      <BrandConsole />
    </main>
  )
}
