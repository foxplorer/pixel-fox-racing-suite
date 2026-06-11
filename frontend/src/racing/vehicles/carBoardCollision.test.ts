import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  resolveCarAdvertisingBoardCollision,
  type CarBoardCollisionScratch,
  type RacingAdvertisingBoard
} from './carBoardCollision'

const assertNear = (actual: number, expected: number, tolerance = 0.000001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`)
}

const createScratch = (): CarBoardCollisionScratch => ({
  curvePoint: new THREE.Vector3(),
  curveTangent: new THREE.Vector3(),
  perpDir: new THREE.Vector3(),
  offsetDir: new THREE.Vector3(),
  boardMidPoint: new THREE.Vector3(),
  boardPoint: new THREE.Vector3(),
  prevBoardPoint: new THREE.Vector3(),
  nearestPoint: new THREE.Vector3(),
  pushDirection: new THREE.Vector3()
})

const createStraightBoard = (): RacingAdvertisingBoard => ({
  curve: new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -30),
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(0, 0, 10),
    new THREE.Vector3(0, 0, 30)
  ]),
  startT: 0,
  endT: 1,
  offset: 0,
  side: 'left',
  height: 3.5
})

test('resolveCarAdvertisingBoardCollision pushes cars out and records sliding tangent', () => {
  const position = new THREE.Vector3(1.5, 0, 0)
  const boardTangent = new THREE.Vector3()

  const result = resolveCarAdvertisingBoardCollision({
    position,
    boards: [createStraightBoard()],
    carRadius: 2,
    boardTangent,
    scratch: createScratch()
  })

  assert.equal(result.collided, true)
  assertNear(position.x, 2.5)
  assertNear(position.z, 0)
  assertNear(boardTangent.length(), 1)
  assertNear(boardTangent.x, 0)
})

test('resolveCarAdvertisingBoardCollision uses longer car shape when nose points into board', () => {
  const position = new THREE.Vector3(1.5, 0, 0)
  const boardTangent = new THREE.Vector3()

  const result = resolveCarAdvertisingBoardCollision({
    position,
    boards: [createStraightBoard()],
    carRadius: 2,
    carForward: new THREE.Vector3(1, 0, 0),
    boardTangent,
    scratch: createScratch()
  })

  assert.equal(result.collided, true)
  assertNear(position.x, 2.55)
  assertNear(position.z, 0)
})

test('resolveCarAdvertisingBoardCollision uses narrower car shape when side faces board', () => {
  const position = new THREE.Vector3(1.15, 0, 0)
  const boardTangent = new THREE.Vector3()

  const result = resolveCarAdvertisingBoardCollision({
    position,
    boards: [createStraightBoard()],
    carRadius: 2,
    carForward: new THREE.Vector3(0, 0, 1),
    boardTangent,
    scratch: createScratch()
  })

  assert.equal(result.collided, true)
  assertNear(position.x, 1.6)
  assertNear(position.z, 0)
})

test('resolveCarAdvertisingBoardCollision skips distant boards', () => {
  const position = new THREE.Vector3(30, 0, 0)
  const boardTangent = new THREE.Vector3(1, 0, 0)

  const result = resolveCarAdvertisingBoardCollision({
    position,
    boards: [createStraightBoard()],
    carRadius: 2,
    boardTangent,
    scratch: createScratch()
  })

  assert.equal(result.collided, false)
  assertNear(position.x, 30)
  assertNear(boardTangent.x, 1)
})
