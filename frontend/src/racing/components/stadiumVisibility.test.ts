import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { DEFAULT_STADIUM_DETAIL_DISTANCE, shouldRenderStadiumDetail } from './stadiumVisibility'

test('shouldRenderStadiumDetail enables detail inside the configured distance', () => {
  assert.equal(
    shouldRenderStadiumDetail(
      new THREE.Vector3(DEFAULT_STADIUM_DETAIL_DISTANCE - 1, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ),
    true
  )
})

test('shouldRenderStadiumDetail disables detail at or beyond the configured distance', () => {
  assert.equal(
    shouldRenderStadiumDetail(
      new THREE.Vector3(DEFAULT_STADIUM_DETAIL_DISTANCE, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ),
    false
  )
})
