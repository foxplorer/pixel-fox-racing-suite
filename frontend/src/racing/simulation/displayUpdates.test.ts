import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceDisplayUpdateCounter,
  DEFAULT_RACING_DISPLAY_UPDATE_INTERVAL_FRAMES,
  getLapDisplayTimeSeconds,
  getSpeedDisplayValue,
  notifyLapDisplayUpdate,
  notifySpeedDisplayUpdate
} from './displayUpdates'

test('advanceDisplayUpdateCounter preserves the six-frame UI update cadence', () => {
  assert.equal(DEFAULT_RACING_DISPLAY_UPDATE_INTERVAL_FRAMES, 6)

  let counter = 0
  for (let i = 0; i < 5; i++) {
    const result = advanceDisplayUpdateCounter(counter)
    counter = result.counter
    assert.equal(result.shouldUpdate, false)
  }

  const result = advanceDisplayUpdateCounter(counter)
  assert.deepEqual(result, {
    counter: 0,
    shouldUpdate: true
  })
})

test('advanceDisplayUpdateCounter recovers from invalid inputs', () => {
  assert.deepEqual(advanceDisplayUpdateCounter(Number.NaN), {
    counter: 1,
    shouldUpdate: false
  })

  assert.deepEqual(advanceDisplayUpdateCounter(5, 0), {
    counter: 0,
    shouldUpdate: true
  })
})

test('display value helpers preserve timer reset and absolute speed display', () => {
  assert.equal(getLapDisplayTimeSeconds(null, 1200), 0)
  assert.equal(getLapDisplayTimeSeconds(1000, 2500), 1.5)
  assert.equal(getSpeedDisplayValue(-12.5), 12.5)
})

test('notify display helpers advance counters and call back on cadence', () => {
  const lapCounter = { current: 5 }
  const speedCounter = { current: 5 }
  const lapUpdates: number[] = []
  const speedUpdates: number[] = []

  notifyLapDisplayUpdate({
    counter: lapCounter,
    lapStartMs: 1000,
    nowMs: 2250,
    onLapTimeUpdate: value => lapUpdates.push(value)
  })
  notifySpeedDisplayUpdate({
    counter: speedCounter,
    speed: -42,
    onSpeedUpdate: value => speedUpdates.push(value)
  })

  assert.equal(lapCounter.current, 0)
  assert.equal(speedCounter.current, 0)
  assert.deepEqual(lapUpdates, [1.25])
  assert.deepEqual(speedUpdates, [42])
})
