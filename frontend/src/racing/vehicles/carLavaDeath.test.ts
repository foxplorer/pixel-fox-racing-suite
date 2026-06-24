import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  advanceLavaDeath,
  createLavaDeathState,
  resetLavaDeathState,
  LAVA_BURN_SECONDS,
  LAVA_EXPLODE_SECONDS
} from './carLavaDeath'

test('stays alive while not over lava', () => {
  const state = createLavaDeathState()
  const frame = advanceLavaDeath({ state, overLava: false, nowSeconds: 0 })
  assert.equal(frame.phase, 'alive')
  assert.equal(frame.heat, 0)
})

test('contact starts the burn, heat ramps 0→1', () => {
  const state = createLavaDeathState()
  const start = advanceLavaDeath({ state, overLava: true, nowSeconds: 10 })
  assert.equal(start.phase, 'burning')
  assert.equal(start.heat, 0)
  const mid = advanceLavaDeath({ state, overLava: true, nowSeconds: 10 + LAVA_BURN_SECONDS / 2 })
  assert.equal(mid.phase, 'burning')
  assert.ok(mid.heat > 0.4 && mid.heat < 0.6)
})

test('burning leaving the lava still keeps burning (committed to death)', () => {
  const state = createLavaDeathState()
  advanceLavaDeath({ state, overLava: true, nowSeconds: 0 })
  const frame = advanceLavaDeath({ state, overLava: false, nowSeconds: 0.1 })
  assert.equal(frame.phase, 'burning')
})

test('explodes after the burn, then finishes once', () => {
  const state = createLavaDeathState()
  advanceLavaDeath({ state, overLava: true, nowSeconds: 0 })
  const exploding = advanceLavaDeath({ state, overLava: true, nowSeconds: LAVA_BURN_SECONDS })
  assert.equal(exploding.phase, 'exploding')
  assert.equal(exploding.heat, 1)

  const done = advanceLavaDeath({
    state,
    overLava: true,
    nowSeconds: LAVA_BURN_SECONDS + LAVA_EXPLODE_SECONDS
  })
  assert.equal(done.phase, 'dead')
  assert.equal(done.justFinished, true)

  const after = advanceLavaDeath({ state, overLava: true, nowSeconds: 100 })
  assert.equal(after.phase, 'dead')
  assert.equal(after.justFinished, false) // only fires once
})

test('reset returns to alive', () => {
  const state = createLavaDeathState()
  advanceLavaDeath({ state, overLava: true, nowSeconds: 0 })
  resetLavaDeathState(state)
  const frame = advanceLavaDeath({ state, overLava: false, nowSeconds: 5 })
  assert.equal(frame.phase, 'alive')
})
