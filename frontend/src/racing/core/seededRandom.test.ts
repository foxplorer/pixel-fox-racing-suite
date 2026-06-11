import assert from 'node:assert/strict'
import test from 'node:test'
import { SeededRandom, WORLD_SEED } from './seededRandom'

test('SeededRandom produces deterministic world generation sequences', () => {
  const first = new SeededRandom(WORLD_SEED)
  const second = new SeededRandom(WORLD_SEED)

  assert.deepEqual(
    Array.from({ length: 5 }, () => first.next()),
    Array.from({ length: 5 }, () => second.next())
  )
})

test('SeededRandom random helpers preserve expected ranges', () => {
  const rng = new SeededRandom(123)

  const floatValue = rng.random(10, 20)
  assert.ok(floatValue >= 10)
  assert.ok(floatValue < 20)

  const intValue = rng.randomInt(3, 7)
  assert.ok(Number.isInteger(intValue))
  assert.ok(intValue >= 3)
  assert.ok(intValue <= 7)
})
