import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { createSpatialTrackIndex } from './spatialTrackIndex'
import {
  createRoadCorridorTerrainHeightSampler,
  findNearestTrackSample,
  getLegacyRoadHeightInfluence,
  getRoadCorridorInfluence,
  smoothstep
} from './roadCorridor'

const createIndex = () => {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2, 0),
    new THREE.Vector3(100, 2, 0),
    new THREE.Vector3(200, 2, 0)
  ], false, 'centripetal', 0.5)

  return createSpatialTrackIndex(curve, { samples: 20, gridSize: 50 })
}

const config = {
  roadWidth: 20,
  shoulderWidth: 10,
  blendDistance: 30,
  roadClearance: 0.25
}

test('findNearestTrackSample returns nearby centerline sample', () => {
  const nearest = findNearestTrackSample(createIndex(), 50, 3)

  assert.ok(nearest.sample)
  assert.ok(nearest.distanceSq < 250)
})

test('getRoadCorridorInfluence flattens the road and shoulder to road height', () => {
  const index = createIndex()
  const road = getRoadCorridorInfluence(index, 50, 0, 12, config)
  const shoulder = getRoadCorridorInfluence(index, 50, 15, 12, config)

  assert.equal(road.zone, 'road')
  assert.equal(road.finalHeight, 2.25)
  assert.equal(shoulder.zone, 'shoulder')
  assert.equal(shoulder.finalHeight, 2.25)
})

test('getRoadCorridorInfluence blends from road height back to terrain height', () => {
  const blend = getRoadCorridorInfluence(createIndex(), 50, 35, 12, config)

  assert.equal(blend.zone, 'blend')
  assert.ok(blend.finalHeight > 2.25)
  assert.ok(blend.finalHeight < 12)
  assert.ok(blend.roadInfluence > 0)
  assert.ok(blend.roadInfluence < 1)
})

test('getRoadCorridorInfluence leaves distant terrain alone', () => {
  const terrain = getRoadCorridorInfluence(createIndex(), 50, 80, 12, config)

  assert.equal(terrain.zone, 'terrain')
  assert.equal(terrain.finalHeight, 12)
  assert.equal(terrain.roadInfluence, 0)
})

test('createRoadCorridorTerrainHeightSampler cuts a road channel through terrain', () => {
  const sampler = createRoadCorridorTerrainHeightSampler(
    createIndex(),
    config,
    () => 12
  )

  assert.equal(sampler(50, 0), 2.25)
  assert.equal(sampler(50, 15), 2.25)
  assert.ok(sampler(50, 35) > 2.25)
  assert.ok(sampler(50, 35) < 12)
  assert.equal(sampler(50, 80), 12)
})

test('smoothstep clamps values', () => {
  assert.equal(smoothstep(-1), 0)
  assert.equal(smoothstep(2), 1)
  assert.equal(smoothstep(0.5), 0.5)
})

test('getLegacyRoadHeightInfluence preserves current track height falloff shape', () => {
  const standardConfig = {
    roadWidth: 18,
    shoulderWidth: 30,
    blendDistance: 30
  }

  assert.deepEqual(getLegacyRoadHeightInfluence(10, 2, standardConfig), {
    height: 2,
    factor: 1
  })

  const blended = getLegacyRoadHeightInfluence(36, 2, standardConfig)
  assert.equal(blended.height, 2)
  assert.equal(blended.factor > 0 && blended.factor < 1, true)

  assert.deepEqual(getLegacyRoadHeightInfluence(60, 2, standardConfig), {
    height: 0,
    factor: 0
  })
})
