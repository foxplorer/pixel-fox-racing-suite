import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceCarControlFrame,
  advanceCarMovementFrame,
  canAdvanceCarFrame,
  getBoardSlidingForwardAdjustment,
  getInactiveCarSpeed,
  getCarMaxSpeed,
  getCarControlState,
  getCarBoardCollisionDistance,
  getCarBoardPushDistance,
  getCarBoardSlidingDirection,
  getCarBoardShapeCollisionDistance,
  getCarDisplacement,
  getCarForwardVector,
  getCarGasVolume,
  getCarSteeringSensitivity,
  getCarSlopeAdjustedMaxSpeed,
  getStableCarRotation,
  hasActiveCarGasKey,
  capCarMovementDelta,
  integrateCarRotation,
  integrateCarSpeed,
  isAnyCarControlActive,
  isCarGasKey,
  isCarMovementKey,
  normalizeCarRotation,
  shouldUseCarBoardSlidingTangent,
  SHARED_CAR_HANDLING
} from './carHandling'

class TestVector {
  constructor(public x = 0, public y = 0, public z = 0) {}

  set(x: number, y: number, z: number): this {
    this.x = x
    this.y = y
    this.z = z
    return this
  }

  copy(vector: TestVector): this {
    this.x = vector.x
    this.y = vector.y
    this.z = vector.z
    return this
  }

  add(vector: TestVector): this {
    this.x += vector.x
    this.y += vector.y
    this.z += vector.z
    return this
  }

  multiplyScalar(scalar: number): this {
    this.x *= scalar
    this.y *= scalar
    this.z *= scalar
    return this
  }

  normalize(): this {
    const length = Math.sqrt(this.lengthSq())
    if (length > 0) {
      this.multiplyScalar(1 / length)
    }
    return this
  }

  dot(vector: TestVector): number {
    return this.x * vector.x + this.y * vector.y + this.z * vector.z
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z
  }
}

const assertNear = (actual: number, expected: number, tolerance = 0.000001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`)
}

test('shared car handling exposes on-track and off-track speed caps', () => {
  assert.equal(getCarMaxSpeed(true), SHARED_CAR_HANDLING.maxSpeedOnTrack)
  assert.equal(getCarMaxSpeed(false), SHARED_CAR_HANDLING.maxSpeedOffTrack)
  assert.equal(SHARED_CAR_HANDLING.downhillMaxSpeedBoostRatio, 0.18)
  assert.equal(SHARED_CAR_HANDLING.offTrackDownhillMaxSpeedBoostRatio, 0.12)
  assert.equal(SHARED_CAR_HANDLING.downhillFullBoostGrade, 0.08)
  assert.equal(SHARED_CAR_HANDLING.downhillOverspeedBleedRate, 0.55)
  assert.equal(SHARED_CAR_HANDLING.offTrackOverspeedBleedRate, 1.8)
  assert.equal(SHARED_CAR_HANDLING.collisionRadius, 2)
  assert.equal(SHARED_CAR_HANDLING.obstacleCollisionSpeedMultiplier, 0.3)
  assert.equal(SHARED_CAR_HANDLING.vehicleCollisionSpeedMultiplier, 0.4)
  assert.equal(SHARED_CAR_HANDLING.boardCollisionSpeedMultiplier, 0.85)
  assert.equal(SHARED_CAR_HANDLING.boardCollisionThickness, 0.05)
  assert.equal(SHARED_CAR_HANDLING.boardCollisionMargin, 0.35)
  assert.equal(SHARED_CAR_HANDLING.boardCollisionPushPadding, 0.1)
  assert.equal(SHARED_CAR_HANDLING.boardCollisionCarHalfWidth, 1.1)
  assert.equal(SHARED_CAR_HANDLING.boardCollisionCarHalfLength, 2.05)
  assert.equal(SHARED_CAR_HANDLING.boardSlidingMinTangentLengthSq, 0.1)
  assert.equal(SHARED_CAR_HANDLING.maxMovementDeltaSeconds, 0.05)
})

test('shared car downhill speed cap boosts more on track than off track', () => {
  assert.equal(
    getCarSlopeAdjustedMaxSpeed({ isOnTrack: true, slopeGrade: 0.04 }),
    SHARED_CAR_HANDLING.maxSpeedOnTrack
  )
  assertNear(
    getCarSlopeAdjustedMaxSpeed({ isOnTrack: true, slopeGrade: -0.08 }),
    SHARED_CAR_HANDLING.maxSpeedOnTrack * 1.18
  )
  assertNear(
    getCarSlopeAdjustedMaxSpeed({ isOnTrack: false, slopeGrade: -0.08 }),
    SHARED_CAR_HANDLING.maxSpeedOffTrack * 1.12
  )
})

test('shared car control mapping reads keyboard controls', () => {
  const controls = getCarControlState({
    KeyW: true,
    ArrowLeft: true,
    KeyS: false
  })

  assert.deepEqual(controls, {
    isAccelerating: true,
    isBraking: false,
    isTurningLeft: true,
    isTurningRight: false
  })
  assert.equal(isAnyCarControlActive(controls), true)
  assert.equal(isAnyCarControlActive(getCarControlState({})), false)
})

test('shared car key predicates identify movement and gas keys', () => {
  assert.equal(isCarMovementKey('ArrowLeft'), true)
  assert.equal(isCarMovementKey('Space'), false)
  assert.equal(isCarGasKey('KeyG'), true)
  assert.equal(isCarGasKey('KeyS'), false)
  assert.equal(hasActiveCarGasKey({ KeyW: true }), true)
  assert.equal(hasActiveCarGasKey({ KeyS: true }), false)
})

test('shared car movement and gas audio helpers keep frame spikes and volume bounded', () => {
  assert.equal(capCarMovementDelta(0.016), 0.016)
  assert.equal(capCarMovementDelta(0.25), SHARED_CAR_HANDLING.maxMovementDeltaSeconds)
  assert.equal(capCarMovementDelta(Number.NaN), 0)
  assert.equal(capCarMovementDelta(-1), 0)
  assertNear(getCarGasVolume(0), 0.07)
  assertNear(getCarGasVolume(SHARED_CAR_HANDLING.maxSpeedOnTrack), 0.35)
  assert.equal(getCarGasVolume(SHARED_CAR_HANDLING.maxSpeedOnTrack * 10), 1)
})

test('shared inactive car movement helpers preserve countdown and loading slowdown', () => {
  assert.equal(canAdvanceCarFrame('racing'), true)
  assert.equal(canAdvanceCarFrame('countdown'), false)
  assert.equal(canAdvanceCarFrame('loading'), false)

  assertNear(getInactiveCarSpeed({ gameStatus: 'countdown', speed: 10 }), 9)
  assertNear(getInactiveCarSpeed({ gameStatus: 'loading', speed: -10 }), -9)
  assert.equal(getInactiveCarSpeed({ gameStatus: 'finished', speed: 10 }), 10)
  assert.equal(getInactiveCarSpeed({ gameStatus: 'countdown', speed: 0.05 }), 0)
})

test('shared car board collision helpers preserve collision and push padding', () => {
  assertNear(getCarBoardCollisionDistance(2), 2.4)
  assertNear(getCarBoardPushDistance(2.4, 1.8), 0.7)
  assert.equal(shouldUseCarBoardSlidingTangent(true, 0.11), true)
  assert.equal(shouldUseCarBoardSlidingTangent(true, 0.1), false)
  assert.equal(shouldUseCarBoardSlidingTangent(false, 1), false)
  assert.equal(getCarBoardSlidingDirection(0.2), 1)
  assert.equal(getCarBoardSlidingDirection(0), -1)
  assert.equal(getCarBoardSlidingDirection(-0.2), -1)
})

test('shared car board collision distance accounts for car shape when heading into a board', () => {
  assertNear(getCarBoardShapeCollisionDistance({
    carForward: { x: 1, z: 0 },
    boardNormal: { x: 1, z: 0 },
    fallbackRadius: 2
  }), 2.45)
  assertNear(getCarBoardShapeCollisionDistance({
    carForward: { x: 0, z: 1 },
    boardNormal: { x: 1, z: 0 },
    fallbackRadius: 2
  }), 1.5)
  assertNear(getCarBoardShapeCollisionDistance({
    carForward: null,
    boardNormal: { x: 1, z: 0 },
    fallbackRadius: 2
  }), 2.4)
})

test('shared board sliding forward adjustment reports when to project movement onto the board tangent', () => {
  assert.deepEqual(getBoardSlidingForwardAdjustment({
    isSlidingAlongBoard: true,
    tangentLengthSq: 1,
    forwardDotTangent: -0.2
  }), {
    shouldSlide: true,
    direction: -1
  })

  assert.deepEqual(getBoardSlidingForwardAdjustment({
    isSlidingAlongBoard: false,
    tangentLengthSq: 1,
    forwardDotTangent: -0.2
  }), {
    shouldSlide: false,
    direction: 1
  })
})

test('shared car forward and displacement helpers match the Three.js car convention', () => {
  assertNear(getCarForwardVector(0).x, 0)
  assertNear(getCarForwardVector(0).z, -1)
  assertNear(getCarForwardVector(Math.PI / 2).x, -1)
  assertNear(getCarForwardVector(Math.PI / 2).z, 0)

  const displacement = getCarDisplacement(0, 10, 0.5)
  assertNear(displacement.x, 0)
  assertNear(displacement.z, -5)
})

test('shared car movement frame writes forward velocity and next position using capped delta', () => {
  const position = new TestVector(10, 1, 20)
  const forward = new TestVector()
  const velocity = new TestVector()
  const movementDelta = new TestVector()
  const nextPosition = new TestVector()

  advanceCarMovementFrame({
    rotationRadians: 0,
    speed: 10,
    deltaSeconds: 1,
    position,
    forward,
    velocity,
    movementDelta,
    nextPosition
  })

  assertNear(forward.x, 0)
  assertNear(forward.z, -1)
  assertNear(velocity.z, -10)
  assertNear(movementDelta.z, -0.5)
  assertNear(nextPosition.x, 10)
  assertNear(nextPosition.y, 1)
  assertNear(nextPosition.z, 19.5)
})

test('shared car movement frame projects forward direction while sliding along a board', () => {
  const position = new TestVector(0, 0, 0)
  const forward = new TestVector()
  const velocity = new TestVector()
  const movementDelta = new TestVector()
  const nextPosition = new TestVector()
  const tangent = new TestVector(1, 0, 0)

  advanceCarMovementFrame({
    rotationRadians: -Math.PI / 2,
    speed: 10,
    deltaSeconds: 0.01,
    position,
    forward,
    velocity,
    movementDelta,
    nextPosition,
    boardSliding: {
      isSlidingAlongBoard: true,
      tangent
    }
  })

  assertNear(forward.x, 1)
  assertNear(forward.z, 0)
  assertNear(velocity.x, 10)
  assertNear(nextPosition.x, 0.1)
  assertNear(nextPosition.z, 0)
})

test('shared car steering becomes less sensitive at high speed', () => {
  assert.equal(getCarSteeringSensitivity(0, 75), 1)
  assertNear(getCarSteeringSensitivity(75, 75), 0.3)
  assertNear(getCarSteeringSensitivity(150, 75), 0.3)
})

test('shared car speed integrates acceleration, braking, and coasting', () => {
  assert.equal(integrateCarSpeed({
    speed: 70,
    deltaSeconds: 1,
    isAccelerating: true,
    isBraking: false,
    isOnTrack: true
  }), 75)

  assert.equal(integrateCarSpeed({
    speed: 0,
    deltaSeconds: 1,
    isAccelerating: false,
    isBraking: true,
    isOnTrack: false
  }), -17.5)

  assertNear(integrateCarSpeed({
    speed: 10,
    deltaSeconds: 1,
    isAccelerating: false,
    isBraking: false,
    isOnTrack: true
  }), 7)
})

test('shared car speed clamps when accelerating from below the off-track cap', () => {
  assert.equal(integrateCarSpeed({
    speed: 34,
    deltaSeconds: 1,
    isAccelerating: true,
    isBraking: false,
    isOnTrack: false
  }), 35)
})

test('shared car speed bleeds off-track overspeed quickly without snapping immediately', () => {
  const nextSpeed = integrateCarSpeed({
    speed: 60,
    deltaSeconds: 0.016,
    isAccelerating: true,
    isBraking: false,
    isOnTrack: false
  })

  assert.equal(nextSpeed < 60, true)
  assert.equal(nextSpeed > SHARED_CAR_HANDLING.maxSpeedOffTrack, true)
})

test('shared car rotation integrates steering and normalizes angle', () => {
  assertNear(integrateCarRotation({
    rotationRadians: 0,
    speed: 10,
    maxSpeed: 75,
    deltaSeconds: 1,
    isTurningLeft: true,
    isTurningRight: false
  }), 1.8133333333333335)

  assert.equal(integrateCarRotation({
    rotationRadians: 2,
    speed: 0.5,
    maxSpeed: 75,
    deltaSeconds: 1,
    isTurningLeft: true,
    isTurningRight: false
  }), 2)
})

test('shared car control frame reads controls and advances speed and rotation', () => {
  const frame = advanceCarControlFrame({
    keys: {
      KeyW: true,
      ArrowLeft: true
    },
    speed: 0,
    rotationRadians: 0,
    deltaSeconds: 1,
    isOnTrack: true
  })

  assert.equal(frame.controls.isAccelerating, true)
  assert.equal(frame.controls.isTurningLeft, true)
  assert.equal(frame.maxSpeed, SHARED_CAR_HANDLING.maxSpeedOnTrack)
  assert.equal(frame.speed, SHARED_CAR_HANDLING.acceleration * SHARED_CAR_HANDLING.maxMovementDeltaSeconds)
  assertNear(frame.rotationRadians, integrateCarRotation({
    rotationRadians: 0,
    speed: SHARED_CAR_HANDLING.acceleration * SHARED_CAR_HANDLING.maxMovementDeltaSeconds,
    maxSpeed: SHARED_CAR_HANDLING.maxSpeedOnTrack,
    deltaSeconds: SHARED_CAR_HANDLING.maxMovementDeltaSeconds,
    isTurningLeft: true,
    isTurningRight: false
  }))
})

test('shared car control frame allows downhill overspeed then bleeds naturally on flat ground', () => {
  const downhillFrame = advanceCarControlFrame({
    keys: { KeyW: true },
    speed: SHARED_CAR_HANDLING.maxSpeedOnTrack,
    rotationRadians: 0,
    deltaSeconds: 1,
    isOnTrack: true,
    slopeGrade: -0.08
  })

  assert.equal(downhillFrame.speed > SHARED_CAR_HANDLING.maxSpeedOnTrack, true)

  const flatFrame = advanceCarControlFrame({
    keys: { KeyW: true },
    speed: downhillFrame.speed,
    rotationRadians: 0,
    deltaSeconds: 1,
    isOnTrack: true,
    slopeGrade: 0
  })

  assert.equal(flatFrame.speed < downhillFrame.speed, true)
  assert.equal(flatFrame.speed > SHARED_CAR_HANDLING.maxSpeedOnTrack, true)
})

test('shared car rotation keeps angles in the stable range', () => {
  assertNear(normalizeCarRotation(Math.PI + 0.5), -Math.PI + 0.5)
  assertNear(normalizeCarRotation(-Math.PI - 0.5), Math.PI - 0.5)
  assertNear(getStableCarRotation(Math.PI * 4 + 0.25), 0.25)
  assertNear(getStableCarRotation(Number.NaN, Math.PI + 0.5), -Math.PI + 0.5)
  assert.equal(getStableCarRotation(Number.POSITIVE_INFINITY, Number.NaN), 0)
})
