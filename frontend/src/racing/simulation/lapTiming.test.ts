import assert from 'node:assert/strict'
import test from 'node:test'
import {
  attemptLapCompletion,
  finalizeLapDistanceFrame,
  getDirectionalTrackProgress,
  updateDirectionalLapProgressAccumulator,
  updateTrackProgressAccumulator,
  validateLapCompletion
} from './lapTiming'

const assertNear = (actual: number | null, expected: number, epsilon = 0.000001) => {
  assert.equal(actual !== null && Math.abs(actual - expected) <= epsilon, true)
}

test('validateLapCompletion accepts a lap with enough distance', () => {
  const result = validateLapCompletion({
    trackLength: 1000,
    distanceSinceLastLap: 920,
    hasCrossedStartLine: false
  })

  assert.equal(result.isValid, true)
  assert.equal(result.minLapDistance, 900)
  assert.deepEqual(result.reasons, [])
})

test('validateLapCompletion rejects short laps and duplicate crossing', () => {
  const result = validateLapCompletion({
    trackLength: 1000,
    distanceSinceLastLap: 500,
    hasCrossedStartLine: true
  })

  assert.equal(result.isValid, false)
  assert.deepEqual(result.reasons, ['insufficient-distance', 'already-crossed'])
})

test('validateLapCompletion can require reaching the end of the track', () => {
  const invalid = validateLapCompletion({
    trackLength: 1000,
    distanceSinceLastLap: 950,
    hasCrossedStartLine: false,
    requiresReachedEnd: true,
    maxTrackT: 0.5
  })
  const valid = validateLapCompletion({
    trackLength: 1000,
    distanceSinceLastLap: 950,
    hasCrossedStartLine: false,
    requiresReachedEnd: true,
    maxTrackT: 0.95
  })

  assert.equal(invalid.isValid, false)
  assert.deepEqual(invalid.reasons, ['missing-reached-end'])
  assert.equal(valid.isValid, true)
})

test('attemptLapCompletion updates lap refs before invoking completion callback', () => {
  const lastLapTime = { current: 1000 as number | null }
  const lastLapDistance = { current: 100 }
  const totalDistanceTraveled = { current: 1050 }
  const hasCrossedStartLine = { current: false }
  let callbackLapTime: number | null = null
  let callbackSawLastLapDistance = 0

  const result = attemptLapCompletion({
    trackLength: 1000,
    onLapComplete: lapTime => {
      callbackLapTime = lapTime
      callbackSawLastLapDistance = lastLapDistance.current
    },
    lastLapTime,
    lastLapDistance,
    totalDistanceTraveled,
    hasCrossedStartLine,
    nowMs: 3500
  })

  assert.equal(result.completed, true)
  assert.equal(result.lapTime, 2.5)
  assert.equal(callbackLapTime, 2.5)
  assert.equal(lastLapDistance.current, 1050)
  assert.equal(callbackSawLastLapDistance, 1050)
  assert.equal(lastLapTime.current, 3500)
  assert.equal(hasCrossedStartLine.current, true)
})

test('attemptLapCompletion reports skipped prerequisites and can reset max track progress', () => {
  const missing = attemptLapCompletion({
    lastLapTime: { current: null },
    lastLapDistance: { current: 0 },
    totalDistanceTraveled: { current: 0 },
    hasCrossedStartLine: { current: false },
    nowMs: 1000
  })

  assert.equal(missing.completed, false)
  assert.deepEqual(missing.skippedReasons, [
    'missing-track-length',
    'missing-lap-callback',
    'missing-lap-start'
  ])

  const maxTrackT = { current: 0.95 as number | null }
  const completed = attemptLapCompletion({
    trackLength: 1000,
    onLapComplete: () => {},
    lastLapTime: { current: 1000 },
    lastLapDistance: { current: 0 },
    totalDistanceTraveled: { current: 950 },
    hasCrossedStartLine: { current: false },
    requiresReachedEnd: true,
    maxTrackT,
    resetMaxTrackTOnCompletion: 0,
    nowMs: 2000
  })

  assert.equal(completed.completed, true)
  assert.equal(maxTrackT.current, 0)
})

test('finalizeLapDistanceFrame clears crossing state after leaving gate and notifies distance', () => {
  const hasCrossedStartLine = { current: true }
  const totalDistanceTraveled = { current: 1234 }
  const distances: number[] = []

  finalizeLapDistanceFrame({
    justLeftStartLine: true,
    hasCrossedStartLine,
    totalDistanceTraveled,
    onDistanceUpdate: distance => distances.push(distance)
  })

  assert.equal(hasCrossedStartLine.current, false)
  assert.deepEqual(distances, [1234])
})

test('updateTrackProgressAccumulator tracks wrapped distance and reached-end progress', () => {
  const lastTrackT = { current: 0.95 as number | null }
  const totalDistanceTraveled = { current: 100 }
  const maxTrackT = { current: 0.95 as number | null }

  const wrapped = updateTrackProgressAccumulator({
    currentTrackT: 0.05,
    trackLength: 1000,
    lastTrackT,
    totalDistanceTraveled,
    maxTrackT,
    isNearTrack: true
  })

  assert.equal(Math.round(wrapped.distanceDelta), 100)
  assert.equal(Math.round(wrapped.totalDistance), 200)
  assert.equal(wrapped.maxTrackT, 1)
  assert.equal(lastTrackT.current, 0.05)
})

test('updateTrackProgressAccumulator ignores large forward jumps for max progress', () => {
  const lastTrackT = { current: 0.1 as number | null }
  const totalDistanceTraveled = { current: 0 }
  const maxTrackT = { current: 0.1 as number | null }

  const jumped = updateTrackProgressAccumulator({
    currentTrackT: 0.4,
    trackLength: 1000,
    lastTrackT,
    totalDistanceTraveled,
    maxTrackT,
    isNearTrack: true
  })

  assert.equal(Math.round(jumped.distanceDelta), 300)
  assert.equal(jumped.maxTrackT, 0.1)
  assert.equal(lastTrackT.current, 0.4)
})

test('getDirectionalTrackProgress supports decreasing clockwise track direction', () => {
  assert.equal(getDirectionalTrackProgress(0.75, 0.5, 1), 0.25)
  assert.equal(getDirectionalTrackProgress(0.25, 0.5, -1), 0.25)
  assertNear(getDirectionalTrackProgress(0.95, 0.05, -1), 0.1)
})

test('updateDirectionalLapProgressAccumulator tracks directional progress and ignores large shortcuts', () => {
  const lastLapProgress = { current: null as number | null }
  const maxLapProgress = { current: null as number | null }

  updateDirectionalLapProgressAccumulator({
    currentTrackT: 0.5,
    startTrackT: 0.5,
    direction: -1,
    lastLapProgress,
    maxLapProgress,
    isNearTrack: true
  })
  updateDirectionalLapProgressAccumulator({
    currentTrackT: 0.4,
    startTrackT: 0.5,
    direction: -1,
    lastLapProgress,
    maxLapProgress,
    isNearTrack: true
  })

  assertNear(maxLapProgress.current, 0.1)

  updateDirectionalLapProgressAccumulator({
    currentTrackT: 0.1,
    startTrackT: 0.5,
    direction: -1,
    lastLapProgress,
    maxLapProgress,
    isNearTrack: true
  })

  assertNear(maxLapProgress.current, 0.1)
})
