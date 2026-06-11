import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCarObstacleCollision, resolveCarPlayerCollision } from './carCircleCollision'

const assertNear = (actual: number, expected: number, tolerance = 0.000001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`)
}

test('resolveCarObstacleCollision pushes away from the first colliding target', () => {
  const position = { x: 1.5, z: 0 }
  const targets = [{ x: 0, z: 0, radius: 1 }]
  let callbackTarget: typeof targets[number] | undefined

  const result = resolveCarObstacleCollision({
    position,
    carRadius: 2,
    targets,
    onCollision: target => {
      callbackTarget = target
    }
  })

  assert.equal(result.collided, true)
  assert.equal(result.target, targets[0])
  assert.equal(callbackTarget, targets[0])
  assertNear(position.x, 3.1)
  assertNear(position.z, 0)
})

test('resolveCarObstacleCollision skips targets outside max check distance', () => {
  const position = { x: 100, z: 0 }

  const result = resolveCarObstacleCollision({
    position,
    carRadius: 2,
    targets: [{ x: 0, z: 0, radius: 200 }],
    maxCheckDistance: 50
  })

  assert.equal(result.collided, false)
  assertNear(position.x, 100)
})

test('resolveCarPlayerCollision uses car radius and vehicle collision margin', () => {
  const position = { x: 3.5, z: 0 }
  const players = [{ position: [0, 0, 0] as [number, number, number] }]

  const result = resolveCarPlayerCollision({
    position,
    carRadius: 2,
    players
  })

  assert.equal(result.collided, true)
  assert.equal(result.target, players[0])
  assertNear(position.x, 4.15)
})
