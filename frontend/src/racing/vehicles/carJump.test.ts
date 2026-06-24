import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceCarJump,
  createCarJumpState,
  findActiveCarJumpZone,
  CAR_JUMP_MIN_LAUNCH_SPEED,
  type CarJumpZone
} from './carJump'

const ZONE: CarJumpZone = { x: 0, z: 0, radius: 10 }

test('no jump zones is a no-op: grounded height passes through unchanged', () => {
  const state = createCarJumpState()
  const frame = advanceCarJump({
    state,
    zones: [],
    x: 0,
    z: 0,
    groundedY: 5,
    speed: 100,
    deltaSeconds: 1 / 60,
    canMove: true
  })
  assert.equal(frame.height, 5)
  assert.equal(frame.speed, 100)
  assert.equal(state.airborne, false)
})

test('findActiveCarJumpZone uses squared-radius circle test', () => {
  assert.equal(findActiveCarJumpZone(0, 0, [ZONE]), ZONE)
  assert.equal(findActiveCarJumpZone(7, 7, [ZONE]), ZONE) // dist ~9.9 < 10 -> inside
  assert.equal(findActiveCarJumpZone(8, 8, [ZONE]), null) // dist ~11.3 > 10 -> outside
})

test('crossing a zone at speed launches the car into an arc and it lands back', () => {
  const state = createCarJumpState()
  const step = (x: number, speed: number) =>
    advanceCarJump({
      state,
      zones: [ZONE],
      x,
      z: 0,
      groundedY: 0,
      speed,
      deltaSeconds: 1 / 60,
      canMove: true
    })

  // Enter the zone above the launch threshold -> goes airborne.
  const launchFrame = step(0, CAR_JUMP_MIN_LAUNCH_SPEED + 10)
  assert.equal(state.airborne, true)
  assert.equal(state.armed, false)
  assert.equal(launchFrame.height > 0, true)

  // Integrate forward many frames while moving out of the zone; eventually lands.
  let frame = launchFrame
  let peak = launchFrame.height
  for (let i = 0; i < 600 && state.airborne; i++) {
    frame = step(50, CAR_JUMP_MIN_LAUNCH_SPEED + 10) // x=50 is outside the zone
    peak = Math.max(peak, frame.height)
  }
  assert.equal(state.airborne, false)
  assert.equal(frame.height, 0) // back to grounded height
  assert.equal(peak > launchFrame.height, true) // rose before falling
})

test('crossing a zone too slowly does not launch', () => {
  const state = createCarJumpState()
  const frame = advanceCarJump({
    state,
    zones: [ZONE],
    x: 0,
    z: 0,
    groundedY: 0,
    speed: CAR_JUMP_MIN_LAUNCH_SPEED - 1,
    deltaSeconds: 1 / 60,
    canMove: true
  })
  assert.equal(state.airborne, false)
  assert.equal(frame.height, 0)
  assert.equal(frame.speed, CAR_JUMP_MIN_LAUNCH_SPEED - 1)
})

test('a single crossing only launches once until the car clears every zone', () => {
  const state = createCarJumpState()
  const fast = CAR_JUMP_MIN_LAUNCH_SPEED + 30
  const inZone = (speed: number) =>
    advanceCarJump({ state, zones: [ZONE], x: 0, z: 0, groundedY: 0, speed, deltaSeconds: 1 / 60, canMove: true })

  inZone(fast)
  assert.equal(state.airborne, true)
  // Run the whole arc out while still sitting over the zone center (x=0).
  for (let i = 0; i < 600 && state.airborne; i++) inZone(fast)
  assert.equal(state.airborne, false)
  // Still inside the zone -> not re-armed -> no second launch.
  const frame = inZone(fast)
  assert.equal(state.airborne, false)
  assert.equal(frame.height, 0)

  // Leave the zone (re-arms), then re-enter -> launches again.
  advanceCarJump({ state, zones: [ZONE], x: 100, z: 0, groundedY: 0, speed: fast, deltaSeconds: 1 / 60, canMove: true })
  assert.equal(state.armed, true)
  inZone(fast)
  assert.equal(state.airborne, true)
})

test('landing tracks a changed grounded height (e.g. terrain past the pit)', () => {
  const state = createCarJumpState()
  const fast = CAR_JUMP_MIN_LAUNCH_SPEED + 30
  advanceCarJump({ state, zones: [ZONE], x: 0, z: 0, groundedY: 0, speed: fast, deltaSeconds: 1 / 60, canMove: true })
  assert.equal(state.airborne, true)
  // Land onto raised ground (groundedY = 3) outside the zone.
  let frame = { height: 0, speed: fast }
  for (let i = 0; i < 600 && state.airborne; i++) {
    frame = advanceCarJump({ state, zones: [ZONE], x: 50, z: 0, groundedY: 3, speed: frame.speed, deltaSeconds: 1 / 60, canMove: true })
  }
  assert.equal(state.airborne, false)
  assert.equal(frame.height, 3)
})

test('launching off a ramp immediately costs speed', () => {
  const state = createCarJumpState()
  const speed = CAR_JUMP_MIN_LAUNCH_SPEED + 30
  const frame = advanceCarJump({
    state,
    zones: [ZONE],
    x: 0,
    z: 0,
    groundedY: 0,
    speed,
    deltaSeconds: 1 / 60,
    canMove: true
  })

  assert.equal(state.airborne, true)
  assert.equal(frame.speed < speed, true)
  assert.equal(frame.speed > 0, true)
})

test('airborne drag keeps reducing speed without flipping direction', () => {
  const state = createCarJumpState()
  const speed = -(CAR_JUMP_MIN_LAUNCH_SPEED + 30)
  const launchFrame = advanceCarJump({
    state,
    zones: [ZONE],
    x: 0,
    z: 0,
    groundedY: 0,
    speed,
    deltaSeconds: 1 / 60,
    canMove: true
  })
  const airborneFrame = advanceCarJump({
    state,
    zones: [ZONE],
    x: 50,
    z: 0,
    groundedY: 0,
    speed: launchFrame.speed,
    deltaSeconds: 1 / 60,
    canMove: true
  })

  assert.equal(airborneFrame.speed < 0, true)
  assert.equal(Math.abs(airborneFrame.speed) < Math.abs(launchFrame.speed), true)
})
