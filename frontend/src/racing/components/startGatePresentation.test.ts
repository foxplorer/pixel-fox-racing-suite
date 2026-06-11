import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  getStartGatePolePositions,
  getStartLightRotationY,
  getStartLineRotationZ
} from './startGatePresentation'

test('getStartGatePolePositions places poles perpendicular to a +Z start direction', () => {
  const poles = getStartGatePolePositions({
    center: new THREE.Vector3(0, 0.1, 0),
    direction: new THREE.Vector3(0, 0, 1),
    halfWidth: 7
  })

  assert.deepEqual(poles, [
    { x: -7, z: 0, radius: 0.5 },
    { x: 7, z: 0, radius: 0.5 }
  ])
})

test('getStartGatePolePositions rotates poles with the start direction', () => {
  const poles = getStartGatePolePositions({
    center: new THREE.Vector3(10, 0.1, 20),
    direction: new THREE.Vector3(1, 0, 0),
    halfWidth: 5,
    radius: 0.75
  })

  assert.deepEqual(poles, [
    { x: 10, z: 25, radius: 0.75 },
    { x: 10, z: 15, radius: 0.75 }
  ])
})

test('start gate rotations align strip and light to the start direction', () => {
  assert.equal(getStartLineRotationZ(new THREE.Vector3(0, 0, 1)), 0)
  assert.equal(getStartLightRotationY(new THREE.Vector3(0, 0, 1)), Math.PI)
  assert.equal(getStartLineRotationZ(new THREE.Vector3(1, 0, 0)), Math.PI / 2)
  assert.equal(getStartLightRotationY(new THREE.Vector3(1, 0, 0)), -Math.PI / 2)
})
