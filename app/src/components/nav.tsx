'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const STEPS = [
  { href: '/hub', step: '1', label: 'Hub', who: 'pays the picker' },
  { href: '/recycler', step: '2', label: 'Recycler', who: 'confirms the plastic' },
  { href: '/brand', step: '3', label: 'Brand', who: 'claims it once' },
] as const

export function Nav() {
  const path = usePathname()
  const active = (href: string) => path === href || path.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-[var(--background)]/90 backdrop-blur dark:border-neutral-800">
      <nav className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
        <Link href="/" className="mr-2 shrink-0 font-semibold">
          PickPay
        </Link>
        {STEPS.map((s, i) => (
          <span key={s.href} className="flex shrink-0 items-center">
            {i > 0 && <span className="px-1 text-neutral-400">→</span>}
            <Link
              href={s.href}
              className={`rounded-lg px-2.5 py-1.5 ${active(s.href) ? 'bg-emerald-600 text-white' : 'hover:bg-neutral-500/10'}`}
            >
              <span className="font-medium">
                {s.step}. {s.label}
              </span>
              <span className={`ml-1 hidden sm:inline ${active(s.href) ? 'text-white/80' : 'text-neutral-500'}`}>{s.who}</span>
            </Link>
          </span>
        ))}
        <Link
          href="/ledger"
          className={`ml-auto shrink-0 rounded-lg px-2.5 py-1.5 font-medium ${active('/ledger') ? 'bg-emerald-600 text-white' : 'hover:bg-neutral-500/10'}`}
        >
          Public ledger
        </Link>
      </nav>
    </header>
  )
}

/** The "who you are, what to do here" block at the top of each role page. */
export function RoleHeader({ step, role, title, children }: { step?: string; role: string; title: string; children: React.ReactNode }) {
  return (
    <header className="mb-6">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
        {step ? `Step ${step} · ` : ''}
        {role}
      </p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{children}</div>
    </header>
  )
}
