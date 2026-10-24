import type { Metadata } from 'next'
import { RoleHeader } from '@/components/nav'
import { RecyclerDesk } from './recycler-desk'

export const metadata: Metadata = { title: 'Recycler · PickPay' }

export default function RecyclerPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <RoleHeader step="2" role="You are the recycler" title="Weigh what arrived and confirm it">
        The hub sends you its paid bags as a bale. You weigh it and confirm the weight. Your confirmation is the only thing
        that counts plastic as recycled, and brands can claim only what you confirm.
      </RoleHeader>
      <RecyclerDesk />
    </main>
  )
}
