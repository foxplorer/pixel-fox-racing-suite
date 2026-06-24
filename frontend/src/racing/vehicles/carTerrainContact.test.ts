import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceCarTerrainContact,
  CAR_TERRAIN_AIR_DRAG_PER_SECOND,
  CAR_TERRAIN_STEEP_CLIMB_SPEED_MULTIPLIER,
  createCarTerrainContactState,
  getCarTerrainMaxClimbDelta,
  isCarTerrainClimbTooSteep
} from './carTerrainContact'

test('terrain contact follows reachable ground height', () => {
  const state = createCarTerrainContactState()
  const frame = advanceCarTerrainContact({
    state,
    currentY: 1,
    targetY: 1.4,
    speed: 20,
    deltaSeconds: 1 / 60,
    horizontalDistance: 2
  })

  assert.equal(frame.height, 1.4)
  assert.equal(frame.speed, 20)
  assert.equal(frame.airborne, false)
  assert.equal(frame.blockedBySteepClimb, false)
})

test('terrain contact enters gravity fall over cliff drops instead of snapping down', () => {
  const state = createCarTerrainContactState()
  const frame = advanceCarTerrainContact({
    state,
    currentY: 8,
    targetY: 0,
    speed: 30,
    deltaSeconds: 1 / 60,
    horizontalDistance: 1
  })

  assert.equal(state.airborne, true)
  assert.equal(frame.airborne, true)
  assert.equal(frame.height < 8, true)
  assert.equal(frame.height > 0, true)
  // Air drag bleeds horizontal speed while airborne (faster cars still carry farther).
  assert.equal(frame.speed, 30 * (1 - CAR_TERRAIN_AIR_DRAG_PER_SECOND / 60))
  assert.equal(frame.speed < 30, true)
})

test('terrain contact lands once gravity reaches the sampled ground', () => {
  const state = createCarTerrainContactState()
  let frame = advanceCarTerrainContact({
    state,
    currentY: 5,
    targetY: 0,
    speed: 30,
    deltaSeconds: 1 / 60,
    horizontalDistance: 1
  })

  for (let i = 0; i < 300 && state.airborne; i++) {
    frame = advanceCarTerrainContact({
      state,
      currentY: frame.height,
      targetY: 0,
      speed: frame.speed,
      deltaSeconds: 1 / 60,
      horizontalDistance: 1
    })
  }

  assert.equal(state.airborne, false)
  assert.equal(frame.height, 0)
})

test('terrain contact blocks climbs beyond distance-based climb limit', () => {
  const state = createCarTerrainContactState()
  const speed = 40
  const frame = advanceCarTerrainContact({
    state,
    currentY: 0,
    targetY: getCarTerrainMaxClimbDelta(1) + 0.01,
    speed,
    deltaSeconds: 1 / 60,
    horizontalDistance: 1
  })

  assert.equal(frame.blockedBySteepClimb, true)
  assert.equal(frame.height, 0)
  assert.equal(frame.speed, speed * CAR_TERRAIN_STEEP_CLIMB_SPEED_MULTIPLIER)
})

test('terrain climb steepness allows gradual ramps and rejects abrupt ledges', () => {
  assert.equal(isCarTerrainClimbTooSteep({
    currentY: 0,
    targetY: getCarTerrainMaxClimbDelta(2),
    horizontalDistance: 2
  }), false)
  assert.equal(isCarTerrainClimbTooSteep({
    currentY: 0,
    targetY: getCarTerrainMaxClimbDelta(2) + 0.001,
    horizontalDistance: 2
  }), true)
})
