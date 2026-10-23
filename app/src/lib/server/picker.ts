import { createHash } from 'node:crypto'

const SALT = process.env.PICKER_SALT ?? 'pickpay-demo-salt'

/** Normalises Nigerian numbers to E.164: "0803 123 4567" → "+2348031234567". */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '')
  if (/^\+234\d{10}$/.test(digits)) return digits
  if (/^234\d{10}$/.test(digits)) return `+${digits}`
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`
  throw new Error('Enter a Nigerian phone number, e.g. 0803 123 4567')
}

/** Salted SHA-256 of the normalised phone; only this hash goes on-chain. */
export const pickerHash = (phone: string) =>
  new Uint8Array(createHash('sha256').update(`${SALT}:${normalizePhone(phone)}`).digest())
