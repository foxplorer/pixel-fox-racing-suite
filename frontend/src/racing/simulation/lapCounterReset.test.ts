import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resetLapCountersForCountdown,
  resetLapCountersForGameStatus,
  resetLapCountersForRaceStart
} from './lapCounterReset'

test('resetLapCountersForRaceStart initializes lap and distance counters', () => {
  const refs = {
    lastLapTime: { current: null as number | null },
    lastLapDistance: { current: 123 },
    hasCrossedStartLine: { current: true },
    isOnStartLine: { current: true },
    totalDistanceTraveled: { current: 456 },
    prevPositionForDistance: { current: { x: 1 } as unknown | null },
    maxTrackT: { current: 0.9 as number | null }
  }

  resetLapCountersForRaceStart(refs, 9876)

  assert.equal(refs.lastLapTime.current, 9876)
  assert.equal(refs.lastLapDistance.current, 0)
  assert.equal(refs.hasCrossedStartLine.current, false)
  assert.equal(refs.isOnStartLine.current, false)
  assert.equal(refs.totalDistanceTraveled.current, 0)
  assert.equal(refs.prevPositionForDistance.current, null)
  assert.equal(refs.maxTrackT.current, null)
})

test('resetLapCountersForCountdown clears lap start time and counters', () => {
  const refs = {
    lastLapTime: { current: 111 as number | null },
    lastLapDistance: { current: 123 },
    hasCrossedStartLine: { current: true },
    isOnStartLine: { current: true }
  }

  resetLapCountersForCountdown(refs)

  assert.equal(refs.lastLapTime.current, null)
  assert.equal(refs.lastLapDistance.current, 0)
  assert.equal(refs.hasCrossedStartLine.current, false)
  assert.equal(refs.isOnStartLine.current, false)
})

test('resetLapCountersForGameStatus applies only racing and countdown states', () => {
  const refs = {
    lastLapTime: { current: null as number | null },
    lastLapDistance: { current: 123 },
    hasCrossedStartLine: { current: true },
    isOnStartLine: { current: true }
  }

  assert.equal(resetLapCountersForGameStatus({
    gameStatus: 'racing',
    refs,
    nowMs: 999
  }), true)
  assert.equal(refs.lastLapTime.current, 999)

  refs.lastLapTime.current = 111
  refs.lastLapDistance.current = 123
  refs.hasCrossedStartLine.current = true
  refs.isOnStartLine.current = true

  assert.equal(resetLapCountersForGameStatus({
    gameStatus: 'countdown',
    refs,
    nowMs: 1000
  }), true)
  assert.equal(refs.lastLapTime.current, null)
  assert.equal(refs.lastLapDistance.current, 0)

  refs.lastLapDistance.current = 42

  assert.equal(resetLapCountersForGameStatus({
    gameStatus: 'finished',
    refs,
    nowMs: 1001
  }), false)
  assert.equal(refs.lastLapDistance.current, 42)
})
