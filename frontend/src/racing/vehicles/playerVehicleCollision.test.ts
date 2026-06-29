import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePlayerVehicleCollision } from './playerVehicleCollision'

const assertNear = (actual: number, expected: number, tolerance = 0.000001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`)
}

test('resolvePlayerVehicleCollision preserves momentum in high-speed rear-end contact', () => {
  const position = { x: 0, z: -3.5 }

  const result = resolvePlayerVehicleCollision({
    position,
    previousPosition: { x: 0, z: -3 },
    speed: 40,
    rotationY: 0,
    carRadius: 2,
    target: {
      id: 'lead',
      position: [0, 0, -5],
      rotation: [0, 0, 0],
      speed: 35
    },
    margin: 0.15,
    minDistanceSq: 0.0001,
    gameStatus: 'racing'
  })

  assert.equal(result.collided, true)
  assert.equal(result.kind, 'rear-end')
  assertNear(result.speed, 38.25)
  assert.ok(result.speed > 35)
  assertNear(position.z, -0.85)
})

test('resolvePlayerVehicleCollision keeps side swipe contact from becoming a dead stop', () => {
  const position = { x: 1.5, z: -5 }

  const result = resolvePlayerVehicleCollision({
    position,
    speed: 32,
    rotationY: 0,
    carRadius: 2,
    target: {
      id: 'side',
      position: [0, 0, -5],
      rotation: [0, 0, 0],
      speed: 30
    },
    margin: 0.15,
    minDistanceSq: 0.0001,
    gameStatus: 'racing'
  })

  assert.equal(result.collided, true)
  assert.equal(result.kind, 'side-swipe')
  assertNear(result.speed, 28.8)
})

test('resolvePlayerVehicleCollision still penalizes head-on impacts more than rear-end contact', () => {
  const position = { x: 0, z: -3.5 }

  const result = resolvePlayerVehicleCollision({
    position,
    speed: 40,
    rotationY: 0,
    carRadius: 2,
    target: {
      id: 'wrong-way',
      position: [0, 0, -5],
      rotation: [0, Math.PI, 0],
      speed: 35
    },
    margin: 0.15,
    minDistanceSq: 0.0001,
    gameStatus: 'racing'
  })

  assert.equal(result.collided, true)
  assert.equal(result.kind, 'head-on')
  assertNear(result.speed, 12.8)
})

test('resolvePlayerVehicleCollision softens repeated sustained contact for the same pair', () => {
  const contactState = new Map()
  const target = {
    id: 'wrong-way',
    position: [0, 0, -5] as [number, number, number],
    rotation: [0, Math.PI, 0] as [number, number, number],
    speed: 35
  }

  const first = resolvePlayerVehicleCollision({
    position: { x: 0, z: -3.5 },
    speed: 40,
    rotationY: 0,
    carRadius: 2,
    target,
    margin: 0.15,
    minDistanceSq: 0.0001,
    gameStatus: 'racing',
    contactState,
    nowMs: 1000
  })

  const repeated = resolvePlayerVehicleCollision({
    position: { x: 0, z: -3.5 },
    speed: first.speed,
    rotationY: 0,
    carRadius: 2,
    target,
    margin: 0.15,
    minDistanceSq: 0.0001,
    gameStatus: 'racing',
    contactState,
    nowMs: 1100
  })

  assert.equal(first.kind, 'head-on')
  assert.equal(repeated.kind, 'head-on')
  assertNear(first.speed, 12.8)
  assertNear(repeated.speed, 11.52)
  assert.equal(contactState.get('player:wrong-way')?.contactFrames, 2)
})

test('resolvePlayerVehicleCollision ignores countdown grid overlap', () => {
  const position = { x: 0, z: 0 }

  const result = resolvePlayerVehicleCollision({
    position,
    speed: 20,
    rotationY: 0,
    carRadius: 2,
    target: {
      id: 'grid',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      speed: 0
    },
    margin: 0.15,
    minDistanceSq: 0.0001,
    gameStatus: 'countdown'
  })

  assert.equal(result.collided, false)
  assert.equal(result.kind, 'staging-overlap')
  assert.equal(result.speed, 20)
  assert.deepEqual(position, { x: 0, z: 0 })
})
