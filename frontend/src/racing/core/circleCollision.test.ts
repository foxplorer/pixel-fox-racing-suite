import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCircleCollisionPush2D, resolveCircleCollision2D } from './circleCollision'

const assertNear = (actual: number, expected: number, tolerance = 0.000001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`)
}

test('circle collision reports no collision when circles are separate', () => {
  const collision = resolveCircleCollision2D({
    ax: 0,
    az: 0,
    ar: 1,
    bx: 4,
    bz: 0,
    br: 1
  })

  assert.equal(collision.collided, false)
})

test('circle collision returns push direction and distance for overlap', () => {
  const collision = resolveCircleCollision2D({
    ax: 1,
    az: 0,
    ar: 2,
    bx: 0,
    bz: 0,
    br: 2,
    margin: 0.1
  })

  assert.equal(collision.collided, true)
  assert.equal(collision.pushX, 1)
  assert.equal(collision.pushZ, 0)
  assertNear(collision.pushDistance, 3.1)
})

test('circle collision can ignore near-zero overlaps to avoid unstable pushes', () => {
  const collision = resolveCircleCollision2D({
    ax: 0,
    az: 0,
    ar: 2,
    bx: 0,
    bz: 0,
    br: 2,
    minDistanceSq: 0.0001
  })

  assert.equal(collision.collided, false)
})

test('circle collision can apply push response to mutable positions', () => {
  const position = { x: 1, z: 0 }
  const collision = resolveCircleCollision2D({
    ax: position.x,
    az: position.z,
    ar: 2,
    bx: 0,
    bz: 0,
    br: 2,
    margin: 0.1
  })

  applyCircleCollisionPush2D(position, collision)

  assertNear(position.x, 4.1)
  assertNear(position.z, 0)
})
