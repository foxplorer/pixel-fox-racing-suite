import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findCarRampFootprintHit,
  isCarRampLipLaunchTransition,
  rampHeightAbove,
  resolveCarRampSideCollision,
  type CarRampZone
} from './carRamp'

// A single ramp anchored at the origin (its outer/ground foot), running up along +Z
// (up axis = (0,1)). The lip sits at the far end, distance `rampLength` from the foot.
// Run 20 long, half-width 5, lip height 6.
const RAMP: CarRampZone = {
  x: 0,
  z: 0,
  upX: 0,
  upZ: 1,
  rampLength: 20,
  halfWidth: 5,
  lipHeight: 6
}

test('no ramp zones is a no-op (flat ground)', () => {
  assert.equal(rampHeightAbove(0, 15, []), 0)
})

test('height rises from 0 at the outer foot to the lip height at the lip', () => {
  assert.equal(rampHeightAbove(0, 0, [RAMP]), 0) // outer foot -> ground
  assert.equal(rampHeightAbove(0, 20, [RAMP]), 6) // lip -> full lip height
  assert.equal(rampHeightAbove(0, 10, [RAMP]), 3) // midpoint -> half height
})

test('past the lip (over the gap) there is no surface', () => {
  assert.equal(rampHeightAbove(0, 21, [RAMP]), 0) // beyond the lip -> open gap
  assert.equal(rampHeightAbove(0, 40, [RAMP]), 0)
})

test('before the outer foot (off the track-side end) there is no surface', () => {
  assert.equal(rampHeightAbove(0, -1, [RAMP]), 0)
  assert.equal(rampHeightAbove(0, -20, [RAMP]), 0)
})

test('points off the side contribute nothing', () => {
  assert.equal(rampHeightAbove(6, 10, [RAMP]), 0) // off to the side (|across| > halfWidth)
})

test('within the ramp width the height is unaffected by across offset', () => {
  assert.equal(rampHeightAbove(5, 10, [RAMP]), 3) // at the width edge
  assert.equal(rampHeightAbove(-5, 10, [RAMP]), 3)
})

test('orientation follows the up axis', () => {
  const sideways: CarRampZone = { ...RAMP, upX: 1, upZ: 0 }
  // Now the ramp runs along X; +Z is the across direction.
  assert.equal(rampHeightAbove(20, 0, [sideways]), 6) // lip
  assert.equal(rampHeightAbove(0, 10, [sideways]), 0) // along old axis -> now across, off footprint
})

test('overlapping ramps take the max height', () => {
  const a: CarRampZone = { ...RAMP, lipHeight: 6 }
  const b: CarRampZone = { ...RAMP, lipHeight: 10 }
  assert.equal(rampHeightAbove(0, 20, [a, b]), 10)
})

test('ramp footprint reports points inside the drivable slab', () => {
  const hit = findCarRampFootprintHit(0, 10, [RAMP])
  assert.equal(hit?.ramp, RAMP)
  assert.equal(hit?.along, 10)
  assert.equal(hit?.across, 0)
  assert.equal(findCarRampFootprintHit(6, 10, [RAMP]), null)
})

test('ramp side collision allows driving up from the outer foot', () => {
  assert.equal(resolveCarRampSideCollision({
    previousX: 0,
    previousZ: -1,
    nextX: 0,
    nextZ: 1,
    ramps: [RAMP]
  }).blocked, false)
})

test('ramp side collision blocks side and over-the-lip entry', () => {
  // Coming in from the side wall.
  assert.equal(resolveCarRampSideCollision({
    previousX: 6,
    previousZ: 10,
    nextX: 5,
    nextZ: 10,
    ramps: [RAMP]
  }).blocked, true)
  // Coming in over the lip from the gap side.
  assert.equal(resolveCarRampSideCollision({
    previousX: 0,
    previousZ: 21,
    nextX: 0,
    nextZ: 20,
    ramps: [RAMP]
  }).blocked, true)
})

test('ramp side collision uses a padded wall around blocked sides', () => {
  const sideCollision = resolveCarRampSideCollision({
    previousX: 8.5,
    previousZ: 10,
    nextX: 7.5,
    nextZ: 10,
    ramps: [RAMP]
  })
  assert.equal(sideCollision.blocked, true)
  assert.equal(sideCollision.slideX, 8.2)
  assert.equal(sideCollision.slideZ, 10)

  const lipCollision = resolveCarRampSideCollision({
    previousX: 0,
    previousZ: 23.5,
    nextX: 0,
    nextZ: 22.5,
    ramps: [RAMP]
  })
  assert.equal(lipCollision.blocked, true)
  assert.equal(lipCollision.slideX, 0)
  assert.equal(lipCollision.slideZ, 23.2)
})

test('ramp side collision projects diagonal movement along the wall', () => {
  const sideCollision = resolveCarRampSideCollision({
    previousX: 8.5,
    previousZ: 10,
    nextX: 7.5,
    nextZ: 12,
    ramps: [RAMP]
  })
  assert.equal(sideCollision.blocked, true)
  assert.equal(sideCollision.slideX, 8.2)
  assert.equal(sideCollision.slideZ, 12)
})

test('ramp side collision allows movement while already on the ramp', () => {
  assert.equal(resolveCarRampSideCollision({
    previousX: 0,
    previousZ: 10,
    nextX: 1,
    nextZ: 11,
    ramps: [RAMP]
  }).blocked, false)
})

test('ramp lip launch transition fires when cresting the lip into the gap', () => {
  assert.equal(isCarRampLipLaunchTransition({
    previousX: 0,
    previousZ: 19.5,
    nextX: 0,
    nextZ: 20.5,
    ramps: [RAMP]
  }), true)
})

test('ramp lip launch transition does not fire away from the lip', () => {
  // Climbing mid-ramp, nowhere near the lip.
  assert.equal(isCarRampLipLaunchTransition({
    previousX: 0,
    previousZ: 5,
    nextX: 0,
    nextZ: 6,
    ramps: [RAMP]
  }), false)
})

test('ramp lip launch transition does not fire outside ramp width', () => {
  assert.equal(isCarRampLipLaunchTransition({
    previousX: 6,
    previousZ: 19.5,
    nextX: 6,
    nextZ: 20.5,
    ramps: [RAMP]
  }), false)
})
