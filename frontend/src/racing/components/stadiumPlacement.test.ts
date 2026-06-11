import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { getStadiumStandPlacement } from './stadiumPlacement'

test('getStadiumStandPlacement offsets stands perpendicular to track direction', () => {
  const placement = getStadiumStandPlacement({
    basePosition: new THREE.Vector3(10, 5, 20),
    baseDirection: new THREE.Vector3(0, 0, 1),
    distanceFromTrack: 38,
    groundY: -1
  })

  assert.deepEqual(placement.leftPos.toArray(), [-28, -1, 20])
  assert.deepEqual(placement.rightPos.toArray(), [48, -1, 20])
})

test('getStadiumStandPlacement faces each stand toward the track', () => {
  const placement = getStadiumStandPlacement({
    basePosition: new THREE.Vector3(0, 0, 0),
    baseDirection: new THREE.Vector3(1, 0, 0),
    distanceFromTrack: 10,
    groundY: 0
  })

  assert.equal(Object.is(placement.leftRotation, -0) ? 0 : placement.leftRotation, 0)
  assert.equal(placement.rightRotation, Math.PI)
})
