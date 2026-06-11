import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCarCollisionFrame } from './carCollisionFrame'
import { SHARED_CAR_HANDLING } from './carHandling'

const assertNear = (actual: number, expected: number, tolerance = 0.000001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`)
}

test('resolveCarCollisionFrame applies obstacle speed loss before later collision checks', () => {
  const position = { x: 1.5, z: 0 }
  const tree = { x: 0, z: 0, radius: 1 }
  let treeCollisionCount = 0

  const result = resolveCarCollisionFrame({
    position,
    speed: 20,
    treeTargets: [tree],
    startingGatePoles: [{ x: 1.5, z: 0, radius: 1 }],
    players: [{ position: [1.5, 0, 0] }],
    onTreeCollision: target => {
      assert.equal(target, tree)
      treeCollisionCount++
    }
  })

  assert.equal(result.collided, true)
  assert.equal(result.isSlidingAlongBoard, false)
  assertNear(result.speed, 20 * SHARED_CAR_HANDLING.obstacleCollisionSpeedMultiplier)
  assertNear(position.x, 3.1)
  assert.equal(treeCollisionCount, 1)
})

test('resolveCarCollisionFrame checks start poles after trees', () => {
  const position = { x: 1.5, z: 0 }

  const result = resolveCarCollisionFrame({
    position,
    speed: 20,
    treeTargets: [],
    startingGatePoles: [{ x: 0, z: 0, radius: 1 }],
    players: []
  })

  assert.equal(result.collided, true)
  assert.equal(result.isSlidingAlongBoard, false)
  assertNear(result.speed, 20 * SHARED_CAR_HANDLING.obstacleCollisionSpeedMultiplier)
})

test('resolveCarCollisionFrame checks players after obstacles and boards', () => {
  const position = { x: 3.5, z: 0 }

  const result = resolveCarCollisionFrame({
    position,
    speed: 20,
    treeTargets: [],
    startingGatePoles: [],
    players: [{ position: [0, 0, 0] }]
  })

  assert.equal(result.collided, true)
  assert.equal(result.isSlidingAlongBoard, false)
  assertNear(result.speed, 20 * SHARED_CAR_HANDLING.vehicleCollisionSpeedMultiplier)
  assertNear(position.x, 4.15)
})

test('resolveCarCollisionFrame preserves speed when nothing collides', () => {
  const position = { x: 100, z: 100 }

  const result = resolveCarCollisionFrame({
    position,
    speed: 20,
    treeTargets: [{ x: 0, z: 0, radius: 1 }],
    startingGatePoles: [{ x: 10, z: 10, radius: 1 }],
    players: [{ position: [20, 0, 20] }],
    treeMaxCheckDistance: 10
  })

  assert.equal(result.collided, false)
  assert.equal(result.isSlidingAlongBoard, false)
  assert.equal(result.speed, 20)
  assert.equal(position.x, 100)
  assert.equal(position.z, 100)
})
