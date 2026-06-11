import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { createIndexedTrackQueries } from './indexedTrackQueries'
import type { SpatialTrackIndex } from './spatialTrackIndex'
import { STANDARD_CAR_TRACK_PROXIMITY } from './trackProximity'

const createTrackIndex = (): SpatialTrackIndex => {
  const samples = [
    { pos: new THREE.Vector3(0, 0, 0), dist: 0, t: 0 },
    { pos: new THREE.Vector3(10, 0, 0), dist: 10, t: 0.5 }
  ]

  return {
    gridSize: 50,
    samples,
    hash: new Map([['0,0', [0, 1]]])
  }
}

test('createIndexedTrackQueries checks indexed near and on-track state', () => {
  const queries = createIndexedTrackQueries({
    trackIndex: createTrackIndex(),
    config: STANDARD_CAR_TRACK_PROXIMITY,
    startPosition: new THREE.Vector3(0, 0, 0)
  })
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(10, 0, 0),
    new THREE.Vector3(20, 0, 0)
  ])

  assert.equal(queries.isOnTrack(new THREE.Vector3(2, 0, 0), curve), true)
  assert.equal(queries.isNearTrack(new THREE.Vector3(20, 0, 0), curve), true)
  assert.equal(queries.isNearTrack(new THREE.Vector3(200, 0, 0), undefined), true)
})

test('createIndexedTrackQueries finds indexed track position and falls back to zero without curve', () => {
  const queries = createIndexedTrackQueries({
    trackIndex: createTrackIndex(),
    config: STANDARD_CAR_TRACK_PROXIMITY,
    startPosition: new THREE.Vector3(0, 0, 0)
  })
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(10, 0, 0),
    new THREE.Vector3(20, 0, 0)
  ])

  assert.equal(queries.findTrackPosition(new THREE.Vector3(10, 0, 0), curve), 0.5)
  assert.equal(queries.findTrackPosition(new THREE.Vector3(10, 0, 0), undefined), 0)
})
