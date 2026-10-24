import type { Metadata } from 'next'
import { RoleHeader } from '@/components/nav'
import { HubForm } from './hub-form'

export const metadata: Metadata = { title: 'Hub · PickPay' }

export default function HubPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <RoleHeader step="1" role="You are the collection hub" title="Pay for a bag of plastic">
        A waste picker hands you a bag. Enter their phone number and the weight, take a photo, and the AI prices it by
        plastic type and how clean it is. Pay, and the picker gets the money straight away.
      </RoleHeader>
      <HubForm />
    </main>
  )
}
