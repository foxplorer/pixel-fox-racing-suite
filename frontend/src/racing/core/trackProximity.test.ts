import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  getOnTrackDistance,
  getTrackProximityConfig,
  isNearIndexedTrack,
  isOnIndexedTrack,
  isWithinDistanceSq,
  isWithinStartTolerance,
  SAN_LUIS_CAR_TRACK_PROXIMITY,
  SNOW_TRACK_PROXIMITY,
  STANDARD_CAR_TRACK_PROXIMITY
} from './trackProximity'

test('track proximity config preserves standard and San Luis widths', () => {
  assert.equal(getOnTrackDistance(STANDARD_CAR_TRACK_PROXIMITY), 11)
  assert.equal(getOnTrackDistance(SAN_LUIS_CAR_TRACK_PROXIMITY), 8)
  assert.equal(getOnTrackDistance(SNOW_TRACK_PROXIMITY), 11)
})

test('track proximity keys resolve to runtime proximity configs', () => {
  assert.equal(getTrackProximityConfig('standard-car'), STANDARD_CAR_TRACK_PROXIMITY)
  assert.equal(getTrackProximityConfig('san-luis'), SAN_LUIS_CAR_TRACK_PROXIMITY)
  assert.equal(getTrackProximityConfig('snow'), SNOW_TRACK_PROXIMITY)
})

test('track proximity helpers compare squared distances and start tolerance', () => {
  assert.equal(isWithinDistanceSq(100, 10), true)
  assert.equal(isWithinDistanceSq(101, 10), false)
  assert.equal(isWithinStartTolerance(4.99, STANDARD_CAR_TRACK_PROXIMITY), true)
  assert.equal(isWithinStartTolerance(5, STANDARD_CAR_TRACK_PROXIMITY), false)
})

test('isNearIndexedTrack uses indexed distance and configured near-track distance', () => {
  const index = {
    gridSize: 50,
    samples: [{ pos: new THREE.Vector3(50, 0, 0), dist: 0, t: 0.5 }],
    hash: new Map([['1,0', [0]]])
  }

  assert.equal(isNearIndexedTrack(
    { x: 50, z: STANDARD_CAR_TRACK_PROXIMITY.nearTrackDistance },
    index,
    STANDARD_CAR_TRACK_PROXIMITY
  ), true)

  assert.equal(isNearIndexedTrack(
    { x: 50, z: STANDARD_CAR_TRACK_PROXIMITY.nearTrackDistance + 1 },
    index,
    STANDARD_CAR_TRACK_PROXIMITY
  ), false)
})

test('isOnIndexedTrack preserves start tolerance, indexed lookup, and coarse fallback', () => {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(100, 0, 0)
  ])
  const index = {
    gridSize: 50,
    samples: [{ pos: new THREE.Vector3(50, 0, 0), dist: 0, t: 0.5 }],
    hash: new Map([['1,0', [0]]])
  }

  assert.equal(isOnIndexedTrack({
    position: { x: 999, z: 999 },
    trackCurve: curve,
    trackIndex: index,
    config: STANDARD_CAR_TRACK_PROXIMITY,
    distanceToStart: 4.99
  }), true)

  assert.equal(isOnIndexedTrack({
    position: { x: 50, z: getOnTrackDistance(STANDARD_CAR_TRACK_PROXIMITY) },
    trackCurve: curve,
    trackIndex: index,
    config: STANDARD_CAR_TRACK_PROXIMITY,
    distanceToStart: 100
  }), true)

  assert.equal(isOnIndexedTrack({
    position: { x: 0, z: 0 },
    trackCurve: curve,
    trackIndex: { gridSize: 50, samples: [], hash: new Map() },
    config: STANDARD_CAR_TRACK_PROXIMITY,
    distanceToStart: 100
  }), true)

  assert.equal(isOnIndexedTrack({
    position: { x: 50, z: getOnTrackDistance(STANDARD_CAR_TRACK_PROXIMITY) + 1 },
    trackCurve: curve,
    trackIndex: index,
    config: STANDARD_CAR_TRACK_PROXIMITY,
    distanceToStart: 100
  }), false)
})
