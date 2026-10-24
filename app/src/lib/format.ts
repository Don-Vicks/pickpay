export const kg = (g: number) =>
  `${(g / 1000).toLocaleString('en-NG', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`

export const naira = (n: number) =>
  `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** tUSDC base units (6 decimals) → "1.17" */
export const usdc = (baseUnits: number | string) => (Number(baseUnits) / 1e6).toFixed(2)

export const when = (unix: number) =>
  new Date(unix * 1000).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })

export const short = (s: string, n = 4) => `${s.slice(0, n)}…${s.slice(-n)}`
