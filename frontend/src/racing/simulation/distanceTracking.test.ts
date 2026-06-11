import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_DISTANCE_TRACKING_STOP_SPEED,
  getHorizontalDistanceDelta,
  shouldTrackDistanceForSpeed,
  updateHorizontalDistanceAccumulator
} from './distanceTracking'

test('getHorizontalDistanceDelta measures movement in the X/Z plane', () => {
  assert.equal(getHorizontalDistanceDelta(
    { x: 1, z: 2 },
    { x: 4, z: 6 }
  ), 5)
})

test('shouldTrackDistanceForSpeed preserves the existing stop threshold', () => {
  assert.equal(DEFAULT_DISTANCE_TRACKING_STOP_SPEED, 0.1)
  assert.equal(shouldTrackDistanceForSpeed(0.1), false)
  assert.equal(shouldTrackDistanceForSpeed(-0.1), false)
  assert.equal(shouldTrackDistanceForSpeed(0.1001), true)
  assert.equal(shouldTrackDistanceForSpeed(-0.1001), true)
})

test('updateHorizontalDistanceAccumulator initializes, accumulates, and resets stopped tracking', () => {
  const previousPosition = { current: null as { x: number; z: number } | null }
  const totalDistanceTraveled = { current: 10 }

  const initialized = updateHorizontalDistanceAccumulator({
    speed: 1,
    position: { x: 1, z: 1 },
    previousPosition,
    totalDistanceTraveled,
    createPreviousPosition: () => ({ x: 0, z: 0 })
  })

  assert.deepEqual(initialized, {
    isTracking: true,
    distanceDelta: 0,
    totalDistance: 10,
    initializedPreviousPosition: true
  })
  assert.deepEqual(previousPosition.current, { x: 1, z: 1 })

  const moved = updateHorizontalDistanceAccumulator({
    speed: 1,
    position: { x: 4, z: 5 },
    previousPosition,
    totalDistanceTraveled,
    createPreviousPosition: () => ({ x: 0, z: 0 })
  })

  assert.equal(moved.distanceDelta, 5)
  assert.equal(moved.totalDistance, 15)
  assert.deepEqual(previousPosition.current, { x: 4, z: 5 })

  const stopped = updateHorizontalDistanceAccumulator({
    speed: 0,
    position: { x: 8, z: 9 },
    previousPosition,
    totalDistanceTraveled,
    createPreviousPosition: () => ({ x: 0, z: 0 })
  })

  assert.equal(stopped.isTracking, false)
  assert.equal(stopped.totalDistance, 15)
  assert.equal(previousPosition.current, null)
})
