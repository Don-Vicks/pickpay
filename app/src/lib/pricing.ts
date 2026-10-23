// Turns an AI grade + scale weight into a picker payout. Integer maths only (kobo, base units).
// Rates are demo values for Lagos hubs; a real hub sets its own table.

export type PolymerName = 'pet' | 'hdpe' | 'mixed'

/** On-chain Polymer enum order (programs/pickpay/src/state.rs). */
export const POLYMER_INDEX: Record<PolymerName, number> = { pet: 0, hdpe: 1, mixed: 2 }

/** Clean-plastic price per kg, in kobo (₦1 = 100 kobo). */
export const KOBO_PER_KG: Record<PolymerName, bigint> = {
  pet: 30_000n, // ₦300/kg
  hdpe: 25_000n, // ₦250/kg
  mixed: 10_000n, // ₦100/kg
}

export const USDC_DECIMALS = 6

export type Quote = {
  koboPerKg: bigint
  koboTotal: bigint
  /** Payout in tUSDC base units (6 decimals). */
  amount: bigint
}

/**
 * Price = clean rate × (1 − contamination) × weight, converted at `ngnPerUsd`.
 * Contamination is in basis points (0..=10_000); weight in grams.
 */
export function quote(polymer: PolymerName, contaminationBps: number, weightG: number, ngnPerUsd: number): Quote {
  if (!Number.isInteger(weightG) || weightG <= 0) throw new Error('weightG must be a positive integer')
  if (!Number.isInteger(contaminationBps) || contaminationBps < 0 || contaminationBps > 10_000)
    throw new Error('contaminationBps must be an integer in 0..=10000')
  if (!(ngnPerUsd > 0)) throw new Error('ngnPerUsd must be positive')

  const koboPerKg = (KOBO_PER_KG[polymer] * BigInt(10_000 - contaminationBps)) / 10_000n
  const koboTotal = (koboPerKg * BigInt(weightG)) / 1_000n
  // kobo → USD: ÷ (ngnPerUsd × 100); → base units: × 10^6. Rate scaled ×100 to keep it integral.
  const ratePer100 = BigInt(Math.round(ngnPerUsd * 100))
  const amount = (koboTotal * 10n ** BigInt(USDC_DECIMALS) * 100n) / (ratePer100 * 100n)
  return { koboPerKg, koboTotal, amount }
}
