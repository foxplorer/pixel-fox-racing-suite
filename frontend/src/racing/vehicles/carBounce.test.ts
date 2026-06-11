import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCarSurfaceVisualY,
  SHARED_CAR_OFF_TRACK_BOUNCE
} from './carBounce'

const assertNear = (actual: number, expected: number, tolerance = 0.000001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`)
}

test('shared car off-track bounce preserves current visual constants', () => {
  assert.equal(SHARED_CAR_OFF_TRACK_BOUNCE.groundHeight, 0.1)
  assert.equal(SHARED_CAR_OFF_TRACK_BOUNCE.bumpIntensity, 0.4)
  assert.equal(SHARED_CAR_OFF_TRACK_BOUNCE.bumpFrequency, 15)
  assert.equal(SHARED_CAR_OFF_TRACK_BOUNCE.secondaryFrequencyMultiplier, 1.7)
  assert.equal(SHARED_CAR_OFF_TRACK_BOUNCE.secondaryIntensityMultiplier, 0.5)
})

test('getCarSurfaceVisualY returns ground height on track or while stopped', () => {
  assert.equal(getCarSurfaceVisualY({
    isOnTrack: true,
    speed: 30,
    elapsedTime: 1
  }), SHARED_CAR_OFF_TRACK_BOUNCE.groundHeight)

  assert.equal(getCarSurfaceVisualY({
    isOnTrack: false,
    speed: 0.1,
    elapsedTime: 1
  }), SHARED_CAR_OFF_TRACK_BOUNCE.groundHeight)
})

test('getCarSurfaceVisualY applies the existing two-wave off-track bounce', () => {
  const elapsedTime = 0.25
  const speed = 17.5
  const speedFactor = 0.5
  const expected = 0.1
    + Math.sin(elapsedTime * 15) * 0.4 * speedFactor
    + Math.sin(elapsedTime * 15 * 1.7) * 0.4 * 0.5 * speedFactor

  assertNear(getCarSurfaceVisualY({
    isOnTrack: false,
    speed,
    elapsedTime
  }), expected)
})
