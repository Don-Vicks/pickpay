// The demo as a list of beats. Each beat is one visual with one caption. `s` is seconds in the
// full (~3 min, meets the 3-minute rule) cut; `short` is seconds in the 2-minute cut (0 = dropped).

// A highlight box over the app, in 0..1 coordinates of the clip or still, shown from `at` to `until`
// seconds (clip time for clips, scene time for stills). `zoom` > 1 pushes in on it.
export type Mark = { at: number; until: number; x: number; y: number; w: number; h: number; label: string; zoom: number }

export type Beat =
  | { kind: 'text'; id: string; s: number; short: number; eyebrow?: string; title: string; sub?: string; accent?: string }
  // Real screen recording from public/clips (scripts/capture-clips.mjs), starting `from` seconds in.
  | { kind: 'clip'; id: string; s: number; short: number; clip: string; from?: number; step?: string; caption: string }
  // Cropped screenshot from public/stills (scripts/crop-stills.mjs).
  | { kind: 'still'; id: string; s: number; short: number; still: string; step?: string; caption: string }

export const BEATS: Beat[] = [
  { kind: 'text', id: 'hook1', s: 7, short: 5, eyebrow: 'Lagos, Nigeria', title: '870,000 tonnes', sub: 'of plastic waste a year. Only a small share is recycled.', accent: '870,000 tonnes' },
  { kind: 'text', id: 'hook2', s: 7, short: 0, title: 'Pickers collect it.', sub: 'They are paid late, in cash, by weight nobody records.' },
  { kind: 'text', id: 'hook3', s: 8, short: 6, title: 'Brands now have to prove it was recycled.', sub: "Nigeria's 2026 plastic rules. Today the proof is a spreadsheet." },
  { kind: 'text', id: 'title', s: 6, short: 5, eyebrow: 'Introducing', title: 'PickPay', sub: 'Every kilo paid once, claimed once.', accent: 'PickPay' },
  { kind: 'clip', id: 'home', s: 11, short: 7, clip: 'home', caption: 'Three people. One public record on Solana.' },

  { kind: 'clip', id: 'hub-empty', s: 6, short: 4, clip: 'hub-fill', step: 'Step 1 · The hub', caption: 'A waste picker brings a bag to the hub.' },
  { kind: 'clip', id: 'hub-filled', s: 8, short: 6, clip: 'hub-fill', from: 5.5, step: 'Step 1 · The hub', caption: 'Phone number, scale weight, a photo of the bag.' },
  { kind: 'still', id: 'hub-graded', s: 12, short: 9, still: 'hub-graded', step: 'Step 1 · The hub', caption: 'AI reads the plastic and the dirt. That sets the price.' },
  { kind: 'still', id: 'hub-paid', s: 11, short: 8, still: 'hub-paid', step: 'Step 1 · The hub', caption: 'Pay: bag recorded and picker paid, in about a second.' },
  { kind: 'clip', id: 'payout-explorer', s: 8, short: 0, clip: 'payout-explorer', step: 'On-chain', caption: "It's a real record on Solana, open for anyone to check." },
  { kind: 'clip', id: 'hub-dup', s: 10, short: 7, clip: 'hub-dup', from: 2.5, step: 'Fraud check', caption: 'Same photo again? Blocked before the AI is even asked.' },

  { kind: 'still', id: 'recycler-bale', s: 10, short: 7, still: 'recycler-bale', step: 'Step 2 · The recycler', caption: 'The hub sends its paid bags to a recycler as one bale.' },
  { kind: 'still', id: 'recycler-ok', s: 10, short: 7, still: 'recycler-ok', step: 'Step 2 · The recycler', caption: "Only the recycler's confirmation counts as recycled." },

  { kind: 'clip', id: 'brand', s: 8, short: 6, clip: 'brand', step: 'Step 3 · The brand', caption: 'Brands claim recycled kilos for their legal target.' },
  { kind: 'clip', id: 'brand-a', s: 9, short: 6, clip: 'brand-a', from: 2.5, step: 'Step 3 · The brand', caption: 'Brand A claims 1 kg. Those kilos are now used up.' },
  { kind: 'clip', id: 'brand-b', s: 7, short: 5, clip: 'brand-b', step: 'Step 3 · The brand', caption: 'Brand B tries to claim 15 kg. Only 4.9 kg is left.' },
  { kind: 'clip', id: 'brand-b-result', s: 8, short: 5, clip: 'brand-b', from: 7, step: 'Step 3 · The brand', caption: "Refused. Claimed kilos can't be claimed again." },
  { kind: 'clip', id: 'refused-log', s: 11, short: 8, clip: 'refused-log', step: 'On-chain', caption: 'Refused by the program itself: AlreadyClaimed.' },

  { kind: 'clip', id: 'ledger', s: 15, short: 9, clip: 'ledger', step: 'Public ledger', caption: 'Anyone can trace a claim back to every bag.' },

  { kind: 'text', id: 'why', s: 10, short: 6, title: 'Paid in seconds. Confirmed by the recycler. Claimed once.', sub: 'The rules live in the program, not in a spreadsheet.' },
  { kind: 'text', id: 'impact', s: 9, short: 0, eyebrow: 'Conservative estimate', title: '≈ 660 t CO₂e a year', sub: 'avoided by one hub recovering a tonne of PET a day, 300 days a year.', accent: '≈ 660 t CO₂e a year' },
  { kind: 'text', id: 'end', s: 15, short: 8, eyebrow: 'IEEE ClimateChain Global Hackathon · Track 3', title: 'PickPay', sub: 'github.com/Don-Vicks/pickpay · live on Solana devnet · next: a pilot with one Lagos hub and one recycler', accent: 'PickPay' },
]

export const FPS = 30
export const TRANSITION = 15 // frames of crossfade between beats

export const beatsFor = (cut: 'full' | 'short') =>
  BEATS.map((b) => ({ ...b, frames: Math.round((cut === 'full' ? b.s : b.short) * FPS) })).filter((b) => b.frames > 0)

export const totalFrames = (cut: 'full' | 'short') => {
  const beats = beatsFor(cut)
  return beats.reduce((s, b) => s + b.frames, 0) - TRANSITION * (beats.length - 1)
}
