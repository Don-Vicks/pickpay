import assert from 'node:assert/strict'
import { test } from 'node:test'
import { quote } from './pricing.ts'

test('clean PET at ₦1,500/$ pays ₦300/kg', () => {
  const q = quote('pet', 0, 1_000, 1_500)
  assert.equal(q.koboPerKg, 30_000n)
  assert.equal(q.koboTotal, 30_000n)
  assert.equal(q.amount, 200_000n) // ₦300 = $0.20
})

test('contamination discounts the rate', () => {
  const q = quote('pet', 600, 6_200, 1_500) // 6% dirty, 6.2 kg
  assert.equal(q.koboPerKg, 28_200n) // ₦282/kg
  assert.equal(q.koboTotal, 174_840n) // ₦1,748.40
  assert.equal(q.amount, 1_165_600n) // $1.1656
})

test('mixed plastic is cheapest', () => {
  assert.ok(quote('mixed', 0, 1_000, 1_500).amount < quote('hdpe', 0, 1_000, 1_500).amount)
})

test('rejects bad inputs', () => {
  assert.throws(() => quote('pet', 0, 0, 1_500))
  assert.throws(() => quote('pet', 10_001, 1_000, 1_500))
  assert.throws(() => quote('pet', 0, 1_000, 0))
})
