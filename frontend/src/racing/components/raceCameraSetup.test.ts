import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { getInitialRaceCameraPosition } from './raceCameraSetup'

test('getInitialRaceCameraPosition offsets behind the start direction', () => {
  const start = new THREE.Vector3(10, 1, 20)
  const direction = new THREE.Vector3(0, 0, 1)

  assert.deepEqual(
    getInitialRaceCameraPosition(start, direction).toArray().map(value => Number(value.toFixed(6))),
    [10, 9, 45]
  )
})

test('getInitialRaceCameraPosition rotates the offset for an x-axis start direction', () => {
  const start = new THREE.Vector3(10, 1, 20)
  const direction = new THREE.Vector3(1, 0, 0)

  assert.deepEqual(
    getInitialRaceCameraPosition(start, direction).toArray().map(value => Number(value.toFixed(6))),
    [35, 9, 20]
  )
})
