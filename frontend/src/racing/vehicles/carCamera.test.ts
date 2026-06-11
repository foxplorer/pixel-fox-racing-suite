import assert from 'node:assert/strict'
import test from 'node:test'
import {
  capCameraDelta,
  clampCameraDistance,
  clampCameraDistanceForZone,
  findCarCameraZoneForTrackT,
  getCarCameraSmoothingRate,
  getExponentialSmoothingFactor,
  isTrackTInRange,
  shouldResetTargetSmoothCamera,
  SHARED_CAR_CAMERA
} from './carCamera'

const assertNear = (actual: number, expected: number, tolerance = 0.000001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`)
}

test('car camera caps large frame deltas', () => {
  assert.equal(capCameraDelta(0.016), 0.016)
  assert.equal(capCameraDelta(0.25), SHARED_CAR_CAMERA.maxDeltaSeconds)
})

test('car camera selects smoothing rates by mode', () => {
  assert.equal(getCarCameraSmoothingRate('simple'), SHARED_CAR_CAMERA.simpleSmoothingRate)
  assert.equal(getCarCameraSmoothingRate('smooth'), SHARED_CAR_CAMERA.smoothSmoothingRate)
  assert.equal(getCarCameraSmoothingRate('damped'), SHARED_CAR_CAMERA.dampedSmoothingRate)
  assert.equal(getCarCameraSmoothingRate('targetsmooth'), SHARED_CAR_CAMERA.targetSmoothSmoothingRate)
  assert.equal(getCarCameraSmoothingRate('velocity'), SHARED_CAR_CAMERA.simpleSmoothingRate)
})

test('car camera computes exponential smoothing factors', () => {
  assertNear(getExponentialSmoothingFactor(0.1, 8), 0.5506710358839459)
})

test('car camera distance helpers keep follow target bounded', () => {
  assert.equal(clampCameraDistance(5), SHARED_CAR_CAMERA.minDistance)
  assert.equal(clampCameraDistance(15), 15)
  assert.equal(clampCameraDistance(30), SHARED_CAR_CAMERA.maxDistance)
  assert.equal(shouldResetTargetSmoothCamera(24.9), false)
  assert.equal(shouldResetTargetSmoothCamera(25.1), true)
  assert.equal(shouldResetTargetSmoothCamera(Number.NaN), true)
})

test('car camera track ranges support normal and wraparound zones', () => {
  assert.equal(isTrackTInRange(0.15, 0.1, 0.2), true)
  assert.equal(isTrackTInRange(0.25, 0.1, 0.2), false)
  assert.equal(isTrackTInRange(0.98, 0.9, 0.1), true)
  assert.equal(isTrackTInRange(0.04, 0.9, 0.1), true)
  assert.equal(isTrackTInRange(0.5, 0.9, 0.1), false)
})

test('car camera resolves optional zone configs for track position', () => {
  const zones = [
    { startT: 0.2, endT: 0.3, height: 4, distance: 8, minDistance: 5, maxDistance: 11 },
    { startT: 0.7, endT: 0.8, height: 3, distance: 7, minDistance: 4, maxDistance: 10 }
  ]

  assert.equal(findCarCameraZoneForTrackT(null, zones), undefined)
  assert.equal(findCarCameraZoneForTrackT(0.25, zones), zones[0])
  assert.equal(findCarCameraZoneForTrackT(0.75, zones), zones[1])
  assert.equal(findCarCameraZoneForTrackT(0.5, zones), undefined)
  assert.equal(clampCameraDistanceForZone(20, zones[0]), 11)
  assert.equal(clampCameraDistanceForZone(3, zones[0]), 5)
  assert.equal(clampCameraDistanceForZone(8, zones[0]), 8)
})
