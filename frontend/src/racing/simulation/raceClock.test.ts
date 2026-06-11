import assert from 'node:assert/strict'
import test from 'node:test'
import { elapsedSeconds, sanitizeSimulationDeltaSeconds, type RaceClock } from './raceClock'

test('elapsedSeconds converts monotonic milliseconds to seconds', () => {
  assert.equal(elapsedSeconds(1000, 2500), 1.5)
})

test('sanitizeSimulationDeltaSeconds keeps simulation time bounded and finite', () => {
  assert.equal(sanitizeSimulationDeltaSeconds(0.016, 0.05), 0.016)
  assert.equal(sanitizeSimulationDeltaSeconds(0.25, 0.05), 0.05)
  assert.equal(sanitizeSimulationDeltaSeconds(0, 0.05), 0)
  assert.equal(sanitizeSimulationDeltaSeconds(-1, 0.05), 0)
  assert.equal(sanitizeSimulationDeltaSeconds(Number.NaN, 0.05), 0)
  assert.equal(sanitizeSimulationDeltaSeconds(Number.POSITIVE_INFINITY, 0.05), 0)
})

test('race clocks can be injected for deterministic timing', () => {
  const clock: RaceClock = {
    nowMs: () => 1234
  }

  assert.equal(clock.nowMs(), 1234)
})
