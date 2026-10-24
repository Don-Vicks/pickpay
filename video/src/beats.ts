// The demo as a list of beats. Each beat is one visual with one caption. `s` is seconds in the
// full (~3 min, meets the 3-minute rule) cut; `short` is seconds in the 2-minute cut (0 = dropped).

export type Zoom = { from: number; to: number; x: number; y: number } // scale over the beat, focus point 0..1
export type Pan = { from: number; to: number } // vertical scroll position 0..1 of a tall screenshot

export type Beat =
  | { kind: 'text'; id: string; s: number; short: number; eyebrow?: string; title: string; sub?: string; accent?: string }
  | {
      kind: 'browser' | 'phone'
      id: string
      s: number
      short: number
      shot: string
      url?: string
      step?: string
      caption: string
      zoom?: Zoom
      pan?: Pan
    }

export const BEATS: Beat[] = [
  { kind: 'text', id: 'hook1', s: 7, short: 5, eyebrow: 'Lagos, Nigeria', title: '870,000 tonnes', sub: 'of plastic waste a year. Only a small share is recycled.', accent: '870,000 tonnes' },
  { kind: 'text', id: 'hook2', s: 7, short: 0, title: 'Pickers collect it.', sub: 'They are paid late, in cash, by weight nobody records.' },
  { kind: 'text', id: 'hook3', s: 8, short: 6, title: 'Brands now have to prove it was recycled.', sub: "Nigeria's 2026 plastic rules. Today the proof is a spreadsheet." },
  { kind: 'text', id: 'title', s: 6, short: 5, eyebrow: 'Introducing', title: 'PickPay', sub: 'Every kilo paid once, claimed once.', accent: 'PickPay' },
  { kind: 'browser', id: 'home', s: 11, short: 7, shot: '01-home.png', url: 'pickpay · how it works', caption: 'Three people. One public record on Solana.' },

  { kind: 'phone', id: 'hub-empty', s: 6, short: 4, shot: '02-hub-empty.png', step: 'Step 1 · The hub', caption: 'A waste picker brings a bag to the hub.' },
  { kind: 'phone', id: 'hub-filled', s: 8, short: 6, shot: '03-hub-filled.png', step: 'Step 1 · The hub', caption: 'Phone number, scale weight, a photo of the bag.', zoom: { from: 1, to: 1.12, x: 0.5, y: 0.7 } },
  { kind: 'phone', id: 'hub-graded', s: 12, short: 9, shot: '04-hub-graded.png', step: 'Step 1 · The hub', caption: 'AI reads the plastic and the dirt. That sets the price.', zoom: { from: 1, to: 1.25, x: 0.5, y: 0.25 } },
  { kind: 'phone', id: 'hub-paid', s: 11, short: 8, shot: '05-hub-paid.png', step: 'Step 1 · The hub', caption: 'Pay: bag recorded and picker paid, in about a second.', zoom: { from: 1, to: 1.08, x: 0.5, y: 0.3 } },
  { kind: 'browser', id: 'payout-explorer', s: 8, short: 0, shot: '14-explorer-payout.png', url: 'explorer.solana.com · devnet', caption: "It's a real record on Solana, open for anyone to check." },
  { kind: 'phone', id: 'hub-dup', s: 10, short: 7, shot: '06-hub-duplicate.png', step: 'Fraud check', caption: 'Same photo again? Blocked before the AI is even asked.', zoom: { from: 1, to: 1.2, x: 0.5, y: 0.85 } },

  { kind: 'browser', id: 'recycler-bale', s: 10, short: 7, shot: '08-recycler-bale.png', url: 'pickpay · recycler', step: 'Step 2 · The recycler', caption: 'The hub sends its paid bags to a recycler as one bale.', zoom: { from: 1, to: 1.15, x: 0.5, y: 0.45 } },
  { kind: 'browser', id: 'recycler-ok', s: 10, short: 7, shot: '09-recycler-confirmed.png', url: 'pickpay · recycler', step: 'Step 2 · The recycler', caption: "Only the recycler's confirmation counts as recycled.", zoom: { from: 1, to: 1.12, x: 0.5, y: 0.5 } },

  { kind: 'browser', id: 'brand', s: 8, short: 6, shot: '10-brand.png', url: 'pickpay · brand', step: 'Step 3 · The brand', caption: 'Brands claim recycled kilos for their legal target.' },
  { kind: 'browser', id: 'brand-a', s: 9, short: 6, shot: '11-brand-a-claimed.png', url: 'pickpay · brand', step: 'Step 3 · The brand', caption: 'Brand A claims 1 kg. Those kilos are now used up.', pan: { from: 0.3, to: 0.75 } },
  { kind: 'browser', id: 'brand-b', s: 7, short: 5, shot: '12-brand-b-refused.png', url: 'pickpay · brand', step: 'Step 3 · The brand', caption: 'Brand B tries to claim 15 kg. Only 4.9 kg is left.', pan: { from: 0.1, to: 0.3 } },
  { kind: 'browser', id: 'brand-b-result', s: 8, short: 5, shot: '12b-refused-result.png', url: 'pickpay · brand', step: 'Step 3 · The brand', caption: "Refused. Claimed kilos can't be claimed again." },
  { kind: 'browser', id: 'refused-log', s: 11, short: 8, shot: '16-explorer-refused-logs.png', url: 'explorer.solana.com · devnet', step: 'On-chain', caption: 'Refused by the program itself: AlreadyClaimed.' },

  { kind: 'browser', id: 'ledger', s: 15, short: 9, shot: '13-ledger-trace-full.png', url: 'pickpay · public ledger', step: 'Public ledger', caption: 'Anyone can trace a claim back to every bag.', pan: { from: 0, to: 1 } },

  { kind: 'text', id: 'why', s: 10, short: 6, title: 'Paid in seconds. Confirmed by the recycler. Claimed once.', sub: 'The rules live in the program, not in a spreadsheet.' },
  { kind: 'text', id: 'impact', s: 9, short: 0, eyebrow: 'Conservative estimate', title: '≈ 660 t CO₂e a year', sub: 'avoided by one hub recovering a tonne of PET a day, 300 days a year.', accent: '≈ 660 t CO₂e a year' },
  { kind: 'text', id: 'end', s: 12, short: 8, eyebrow: 'IEEE ClimateChain Global Hackathon · Track 3', title: 'PickPay', sub: 'Live on Solana devnet · program 47EH…gLTz · next: a pilot with one Lagos hub and one recycler', accent: 'PickPay' },
]

export const FPS = 30
export const TRANSITION = 15 // frames of crossfade between beats

export const beatsFor = (cut: 'full' | 'short') =>
  BEATS.map((b) => ({ ...b, frames: Math.round((cut === 'full' ? b.s : b.short) * FPS) })).filter((b) => b.frames > 0)

export const totalFrames = (cut: 'full' | 'short') => {
  const beats = beatsFor(cut)
  return beats.reduce((s, b) => s + b.frames, 0) - TRANSITION * (beats.length - 1)
}
